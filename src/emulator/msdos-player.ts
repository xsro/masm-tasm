import { exec } from 'child_process';
import { Terminal, Uri, window, workspace, WorkspaceConfiguration } from 'vscode';
import { ASMTYPE, Config, DOSEMU, settingsStrReplacer, SRCFILE } from '../ASM/configration';
import { ASMCMD, ASMPREPARATION, ASSEMBLERMSG, EMURUN, MSGProcessor } from '../ASM/runcode';

/**the config from VSCode settings `masmtasm.msdos`*/
class MsdosVSCodeConfig {
    private get _target(): WorkspaceConfiguration {
        return workspace.getConfiguration('masmtasm.msdos');
    };
    getAction(scope: MsdosActionKey): string {
        const id = 'masmtasm.msdos.more';
        const a = this._target.get('more') as { [id: string]: string };
        if (a === null || a === undefined) {
            window.showErrorMessage(`${a} is not allowed in ${id}`);
        } else {
            let output = a[scope];
            if (typeof (output) === 'string') {
                if (this.replacer) {
                    output = this.replacer(output);
                }
                return output;
            }
            else {
                window.showErrorMessage(`action ${scope} is undefined or not a array in ${id}`);
            }
        }
        throw new Error(`no ${scope} in ${id}:${JSON.stringify(a)}`);
    }
    replacer: ((str: string) => string) | undefined = undefined;
}

interface MsdosAction {
    workspace: string;
    path: string;
    masm: string;
    tasm: string;
    masm_debug: string;
    run: string;
}

type MsdosActionKey = keyof MsdosAction;

export class MsdosPlayer implements EMURUN {
    static getASMmessage(val: string): ASSEMBLERMSG {
        const asm = /\s*===ASM message===([\s\S]*?)===ASM END===\s*/;
        const lnk = /\s*===LINK message===([\s\S]*?)===LINK END===\s*/;
        const asmre = asm.exec(val);
        const lnkre = lnk.exec(val);
        if (asmre && lnkre && asmre[1] && lnkre[1]) {
            return {
                asm: asmre[1],
                link: lnkre[1]
            };
        }
        console.error('no message scaned', val);
        return val;
    }
    copyUri?: Uri;
    forceCopy?: boolean;
    private _conf: Config;
    private _vscConf: MsdosVSCodeConfig;
    static msdosTerminal: Terminal | undefined = undefined;
    constructor(conf: Config) {
        this._conf = conf;
        this._vscConf = new MsdosVSCodeConfig();
        const ws = this._vscConf.getAction('workspace');
        this.copyUri = ws ? Uri.file(ws) : undefined;
    }

    prepare(opt?: ASMPREPARATION): boolean {
        if (opt) {
            if (this._conf.MASMorTASM === ASMTYPE.TASM && opt.act === ASMCMD.debug && this._conf.DOSemu === DOSEMU.msdos) {
                const msg = `disabled for tasm's TD is hardly runable in msdos`;
                window.showErrorMessage(msg);
                return false;
            }
            this.forceCopy = opt.src.filename.includes(' ');
        }
        this._vscConf.replacer = (
            (val: string): string => settingsStrReplacer(val, this._conf, opt ? opt.src : undefined)
        );
        return true;
    }
    openEmu(folder: Uri, command?: string): boolean {
        const re = folder.fsPath.match(/([a-zA-Z]):/);
        const disk = re ? `${re[1]}:` : ``;
        const cmd = [
            `${disk}`,
            `cd ${folder.fsPath}`,
        ];
        if (command) {
            cmd.push(command);
        }
        this.outTerminal(cmd.join(' & '));
        return true;
    }
    async Run(src: SRCFILE, msgprocessor: MSGProcessor): Promise<boolean> {
        const msg = await this.runPlayer(this._conf).catch((e) => { throw new Error(e); });
        if (await msgprocessor(msg)) {
            this.openEmu(src.folder, `${this._vscConf.getAction('run')}`);
            return true;//'command sended to terminal'
        }
        return false;
    }
    async Debug(src: SRCFILE, msgprocessor: MSGProcessor): Promise<boolean> {
        const msg = await this.runPlayer(this._conf);
        if (await msgprocessor(msg)) {
            const act = this._vscConf.getAction('masm_debug');
            this.openEmu(src.folder, `${act}`);
            return true;
        }
        return false;
    }

    private outTerminal(command?: string): void {
        const env: NodeJS.ProcessEnv = process.env;
        const envPath = env.PATH + ';' + this._vscConf.getAction('path');
        if (MsdosPlayer.msdosTerminal?.exitStatus || MsdosPlayer.msdosTerminal === undefined) {
            MsdosPlayer.msdosTerminal = window.createTerminal({
                env: { PATH: envPath },
                shellPath: "cmd.exe",
                hideFromUser: false,
            });
        }
        if (MsdosPlayer.msdosTerminal) {
            MsdosPlayer.msdosTerminal.show(true);
            if (command) {
                MsdosPlayer.msdosTerminal.sendText(command);
            }
        }
    }
    public runPlayer(conf: Config): Promise<ASSEMBLERMSG> {
        const command = this._vscConf.getAction(conf.MASMorTASM.toLowerCase() as 'masm' | 'tasm');
        return new Promise<ASSEMBLERMSG>(
            (resolve, reject) => {
                const timeout = 3000;
                const child = exec(
                    command,
                    {
                        cwd: conf.Uris.tools.fsPath, timeout
                    },
                    (error, stdout, stderr) => {
                        if (stderr) {
                            console.warn(`stderr: ${stderr}`);
                        }
                        if (error) {
                            reject(error);
                        }
                        else if (stdout.length > 0) {
                            resolve(MsdosPlayer.getASMmessage(stdout));
                        }
                    }
                );
                child.on('exit', (code) => {
                    if (code === null) {
                        child.kill();
                        window.showErrorMessage(`Run playerasm.bat timeout after ${timeout}ms\t\nCommand: ${command}`);
                    }
                    else if (code !== 0) {
                        const msg = `Use playerasm.bat Failed\t exitcode${code}\t\n  command:${command}`;
                        window.showErrorMessage(msg);
                    }
                });
            }
        );
    }
    static dispose(): void {
        MsdosPlayer.msdosTerminal?.dispose();
    }
}