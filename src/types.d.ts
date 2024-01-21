
type AsyncReturnType<T extends (...args: any) => Promise<any>> =
    T extends (...args: any) => Promise<infer R> ? R : any;


declare var CONNECTED: boolean;
declare var _dsconf_data: DSCONFIG_T;

type ProjInfo = {
    title: string,
    file: string,
    ext: "js" | "html" | "py"
}

type LocalProject = {
    // The path of the local project
    path: string;
    // The project name
    PROJECT: string;
    // Indicates whether the project should be reloaded
    reload: boolean;
    // The timestamp when the project was created
    created: number;
};

type DsInfo = {
    // The version of DroidScript
    version?: number;
    // The status of DroidScript
    status?: string;
    // The last program used
    lastprog?: string;
    // The application name
    appname?: string;
    // Indicates whether a password is used
    usepass?: boolean;
    // The device name
    devicename?: string;
    // The MAC address
    macaddress?: string;
    // Indicates whether it is a premium version
    premium?: boolean;
    // The platform (e.g., Android)
    platform?: string;
    // Indicates whether it is an embedded system
    embedded?: boolean;
    // Indicates whether experiments are enabled
    experiments?: boolean;
    // The display width
    dispwidth?: number;
    // The display height
    dispheight?: number;
    // The language setting
    language?: string;
}

// DSCONFIG object representing the configuration for DroidScript
declare type DSCONFIG_T = {
    // The version of the Extension
    VERSION: number;
    // The IP address of the DroidScript server
    serverIP: string;
    // The port number
    PORT: string;
    // Password used by DroidScript CLI
    password?: string;
    // reload project
    reload?: string,
    // An array of local projects
    localProjects: LocalProject[];
    // DroidScript info object
    info: DsInfo;
};

type DSServerResponse<T = {}> =
    { status: "ok" } & T |
    { status: "bad", error?: any, data?: any }
