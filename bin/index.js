#! /usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scan = exports.computeTargetPlatform = exports.getTargetPlatform = exports.platform = exports.isLinux = exports.isMacintosh = exports.isWindows = exports.PlatformToString = void 0;
const axios_1 = __importDefault(require("axios"));
const promises_1 = __importDefault(require("node:fs/promises"));
const node_fs_1 = require("node:fs");
const node_process_1 = __importDefault(require("node:process"));
const path_1 = require("path");
const zlib_1 = __importDefault(require("zlib"));
const tar_stream_1 = __importDefault(require("tar-stream"));
const fsExtra = __importStar(require("fs-extra"));
let _isWindows = false;
let _isMacintosh = false;
let _isLinux = false;
const nodeProcess = node_process_1.default;
// Native environment
if (typeof nodeProcess === "object") {
    _isWindows = nodeProcess.platform === "win32";
    _isMacintosh = nodeProcess.platform === "darwin";
    _isLinux = nodeProcess.platform === "linux";
}
function PlatformToString(platform) {
    switch (platform) {
        case 0 /* Platform.Mac */:
            return "Mac";
        case 1 /* Platform.Linux */:
            return "Linux";
        case 2 /* Platform.Windows */:
            return "Windows";
    }
}
exports.PlatformToString = PlatformToString;
let _platform = 1 /* Platform.Linux */;
if (_isMacintosh) {
    _platform = 0 /* Platform.Mac */;
}
else if (_isWindows) {
    _platform = 2 /* Platform.Windows */;
}
else if (_isLinux) {
    _platform = 1 /* Platform.Linux */;
}
exports.isWindows = _isWindows;
exports.isMacintosh = _isMacintosh;
exports.isLinux = _isLinux;
exports.platform = _platform;
function getTargetPlatform(platform, arch) {
    switch (platform) {
        case 2 /* Platform.Windows */:
            if (arch === "x64") {
                return "win32-x64" /* TargetPlatform.WIN32_X64 */;
            }
            if (arch === "arm64") {
                return "win32-arm64" /* TargetPlatform.WIN32_ARM64 */;
            }
            return "unknown" /* TargetPlatform.UNKNOWN */;
        case 1 /* Platform.Linux */:
            if (arch === "x64") {
                return "linux-x64" /* TargetPlatform.LINUX_X64 */;
            }
            if (arch === "arm64") {
                return "linux-arm64" /* TargetPlatform.LINUX_ARM64 */;
            }
            if (arch === "arm") {
                return "linux-armhf" /* TargetPlatform.LINUX_ARMHF */;
            }
            return "unknown" /* TargetPlatform.UNKNOWN */;
        case "alpine":
            if (arch === "x64") {
                return "alpine-x64" /* TargetPlatform.ALPINE_X64 */;
            }
            if (arch === "arm64") {
                return "alpine-arm64" /* TargetPlatform.ALPINE_ARM64 */;
            }
            return "unknown" /* TargetPlatform.UNKNOWN */;
        case 0 /* Platform.Mac */:
            if (arch === "x64") {
                return "darwin-x64" /* TargetPlatform.DARWIN_X64 */;
            }
            if (arch === "arm64") {
                return "darwin-arm64" /* TargetPlatform.DARWIN_ARM64 */;
            }
            return "unknown" /* TargetPlatform.UNKNOWN */;
    }
}
exports.getTargetPlatform = getTargetPlatform;
async function isAlpineLinux() {
    if (!exports.isLinux) {
        return false;
    }
    let content;
    try {
        const fileContent = await promises_1.default.readFile("/etc/os-release");
        content = fileContent.toString();
    }
    catch (error) {
        try {
            const fileContent = await promises_1.default.readFile("/usr/lib/os-release");
            content = fileContent.toString();
        }
        catch (error) {
            /* Ignore */
            console.debug(`Error while getting the os-release file.`, error);
        }
    }
    return (!!content && (content.match(/^ID=([^\u001b\r\n]*)/m) || [])[1] === "alpine");
}
async function computeTargetPlatform() {
    const alpineLinux = await isAlpineLinux();
    const targetPlatform = getTargetPlatform(alpineLinux ? "alpine" : exports.platform, node_process_1.default.arch);
    console.debug("ComputeTargetPlatform:", targetPlatform);
    return targetPlatform;
}
exports.computeTargetPlatform = computeTargetPlatform;
async function extractFile(filename) {
    try {
        console.log("Unzipping file...");
        //tar.gz is two parts, first unzip, then untar.
        const tarFilePath = `./${filename}`;
        const targetDirectory = "./downloads";
        // without streams.... it's much simpler
        // tar
        //   .x({
        //     file: tarFilePath,
        //     cwd: targetDirectory,
        //   })
        //   .then(() => {
        //     console.log("Extraction complete");
        //   })
        //   .catch((error: unknown) => {
        //     console.error("An error occurred:", error);
        //   });
        const extract = tar_stream_1.default.extract();
        const extractionPromise = new Promise((resolve, reject) => {
            extract.on("entry", async (header, stream, next) => {
                const filePath = (0, path_1.join)(targetDirectory, header.name);
                // Ensure the directory exists
                await fsExtra.ensureDir((0, path_1.dirname)(filePath));
                stream.pipe((0, node_fs_1.createWriteStream)(filePath));
                stream.on("end", function () {
                    next(); // ready for next entry
                });
                stream.resume(); // just auto drain the stream
            });
            extract.on("finish", () => {
                console.log("Extraction complete");
            });
        });
        (0, node_fs_1.createReadStream)(tarFilePath).pipe(zlib_1.default.createGunzip()).pipe(extract);
        await extractionPromise;
    }
    catch (error) {
        console.error(error);
    }
}
/*
 * Function used programmatically to trigger an analysis.
 */
async function scan() {
    console.log("Starting analysis...");
    let responsePipe = null;
    // first get platform.
    try {
        console.log({
            platform: PlatformToString(exports.platform),
        });
        await computeTargetPlatform();
    }
    catch (error) {
        console.error(error);
    }
    const filename = `OpenJDK21U-jre_${archToString(node_process_1.default.arch)}_${PlatformToString(exports.platform).toLowerCase()}_hotspot_21.0.2_13.tar.gz`;
    // then download the file.
    try {
        if (!(0, node_fs_1.existsSync)(filename)) {
            console.log(`download from https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.2%2B13/${filename}`);
            await new Promise((resolve, reject) => {
                (0, axios_1.default)({
                    method: "get",
                    url: `https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.2%2B13/${filename}`,
                    responseType: "stream",
                }).then(function (response) {
                    const stream = response.data.pipe((0, node_fs_1.createWriteStream)(filename));
                    stream.on("finish", () => {
                        console.log("Stream Finished");
                        resolve(null);
                    });
                    stream.on("error", (error) => {
                        console.log("Stream Error", error);
                        reject(error);
                    });
                    stream.on("close", () => {
                        console.log("Stream Closed");
                    });
                });
            });
        }
        else {
            console.log("File already exists.");
        }
        console.log("Extracting File...");
        await extractFile(filename);
    }
    catch (error) {
        console.error(error);
    }
    finally {
        console.log("Analysis finished.");
    }
}
exports.scan = scan;
//TODO: remove, to be handled by api
function archToString(arch) {
    if (arch === "arm64") {
        return "aarch64";
    }
    else if (arch === "arm") {
        return "aarch32";
    }
    return arch;
}
