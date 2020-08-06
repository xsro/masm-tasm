import {  workspace, window, Uri, FileSystem} from 'vscode';
import { TextEncoder } from 'util'
/**
 * 获取配置信息
 */
export class Config {
    private _toolspackaged:boolean=true//如果打包时没有包含汇编工具（tools）改为false
    private _path:string|undefined
    private _BOXrun: string|undefined
    private _DOSemu: string|undefined
    private _exturi: Uri
    public readonly toolsUri:Uri
    public readonly resolution: string | undefined
    public readonly savefirst: boolean|undefined
    public readonly MASMorTASM: string | undefined
    public static writefile: any
    constructor(exturi:Uri) {
        this.resolution = workspace.getConfiguration('masmtasm.dosbox').get('CustomResolution');
        this.MASMorTASM= workspace.getConfiguration('masmtasm.ASM').get('MASMorTASM');
        this._DOSemu= workspace.getConfiguration('masmtasm.ASM').get('emulator');
        this.savefirst= workspace.getConfiguration('masmtasm.ASM').get('savefirst');
        this._BOXrun=workspace.getConfiguration('masmtasm.dosbox').get('run');
        this._path=workspace.getConfiguration('masmtasm.ASM').get('toolspath');
        this._exturi=exturi
        this.toolsUri=this._toolsUri()
        this.writeBoxconfig(this)
    }
    public get batchpath():string{
        let path=Uri.joinPath(this._exturi,'./scripts').fsPath
        return path
    }
    public get dosboxconfuri():Uri{
        let uri=Uri.joinPath(this._exturi,'./scripts/VSC-ExtUse.conf')
        return uri
    }
    public get workpath():string{
        let path=Uri.joinPath(this._exturi,'./scripts/work').fsPath
        return path
    }
    public get workloguri():Uri{
        let uri=Uri.joinPath(this._exturi,'./scripts/work/T.TXT')
        return uri
    }
    public get msbatpath(){
        let path=Uri.joinPath(this._exturi,'./scripts/playerasm.bat').fsPath
        return path
    }
    /**
     * 返回string格式的工具集地址
     */
    public get path(): string{
        let path=this.toolsUri.fsPath
        return path
    }
    private  _toolsUri(): Uri{
        let uri:Uri
        if (this._path){
            uri=Uri.file(this._path)//1.首先使用自定义的工具集
            }
        else if(this._toolspackaged){
            uri=Uri.joinPath(this._exturi,'./tools')//2.其次使用插件打包的工具集
            }
        else {
            window.showInformationMessage('未设置汇编工具路径请在设置中添加相关设置');
            throw new Error("no tools please add your tool in settings");
            }
        return uri
    }
    public get boxruncmd():string{
        let command:string=' '
        switch(this._BOXrun){
            case "keep":command=' ';break;
            case "exit after run":command='exit';break;
            case "pause then exit after run":command='pause \n exit';break
        }
        return command
    }
    public get boxrunbat():string{
        let param:string=' '
        switch(this._BOXrun){
            case "keep":param='k';break;
            case "exit after run":param='e';break;
            case "pause then exit after run":param='p';break
        }
        return param
    }
    public get DOSemu():string
    {
        let dosemu=' '
        if(this._DOSemu) dosemu=this._DOSemu
        if (process.platform!='win32')   dosemu='dosbox'//在linux下无法使用msdos只使用dosbox
        return dosemu
    }
    private writeBoxconfig(conf:Config,autoExec?: string)
    {
        let configUri=conf.dosboxconfuri
        let Pathadd=' '
        Pathadd='set PATH=c:\\tasm;c:\\masm'
        let configContent = `[sdl]
windowresolution=${conf.resolution}
output=opengl
[autoexec]
mount c "${conf.path}"
mount d "${conf.workpath}"
mount x "${conf.batchpath}"
d:
${Pathadd}`;
        if (autoExec) configContent=configContent+'\n'+autoExec
        this.writefile(configUri,configContent)
    }
    public writefile(Uri:Uri,Content:string){
        let fs: FileSystem = workspace.fs
        fs.writeFile(Uri, new TextEncoder().encode(Content))
    }
}