#! /usr/bin/env node
import axios from "axios";
import fs from "node:fs/promises";
import { createWriteStream, createReadStream, existsSync } from "node:fs";
import process from "node:process";
import { join, dirname } from "path";
import zlib from "zlib";
import tarStream from "tar-stream";
import * as fsExtra from "fs-extra";
import tar from "tar";

let _isWindows = false;
let _isMacintosh = false;
let _isLinux = false;

const nodeProcess = process;

// Native environment
if (typeof nodeProcess === "object") {
  _isWindows = nodeProcess.platform === "win32";
  _isMacintosh = nodeProcess.platform === "darwin";
  _isLinux = nodeProcess.platform === "linux";
}

/**
 * This interface is intentionally not identical to node.js
 * process because it also works in sandboxed environments
 * where the process object is implemented differently. We
 * define the properties here that we need for `platform`
 * to work and nothing else.
 */

export const enum TargetPlatform {
  WIN32_X64 = "win32-x64",
  WIN32_ARM64 = "win32-arm64",

  LINUX_X64 = "linux-x64",
  LINUX_ARM64 = "linux-arm64",
  LINUX_ARMHF = "linux-armhf",

  ALPINE_X64 = "alpine-x64",
  ALPINE_ARM64 = "alpine-arm64",

  DARWIN_X64 = "darwin-x64",
  DARWIN_ARM64 = "darwin-arm64",

  WEB = "web",

  UNIVERSAL = "universal",
  UNKNOWN = "unknown",
  UNDEFINED = "undefined",
}

export const enum Platform {
  Mac,
  Linux,
  Windows,
}

export type PlatformName = "Windows" | "Mac" | "Linux";

export function PlatformToString(platform: Platform): PlatformName {
  switch (platform) {
    case Platform.Mac:
      return "Mac";
    case Platform.Linux:
      return "Linux";
    case Platform.Windows:
      return "Windows";
  }
}

let _platform: Platform = Platform.Linux;
if (_isMacintosh) {
  _platform = Platform.Mac;
} else if (_isWindows) {
  _platform = Platform.Windows;
} else if (_isLinux) {
  _platform = Platform.Linux;
}

export const isWindows = _isWindows;
export const isMacintosh = _isMacintosh;
export const isLinux = _isLinux;
export const platform = _platform;

export function getTargetPlatform(
  platform: Platform | "alpine",
  arch: string | undefined
): TargetPlatform {
  switch (platform) {
    case Platform.Windows:
      if (arch === "x64") {
        return TargetPlatform.WIN32_X64;
      }
      if (arch === "arm64") {
        return TargetPlatform.WIN32_ARM64;
      }
      return TargetPlatform.UNKNOWN;

    case Platform.Linux:
      if (arch === "x64") {
        return TargetPlatform.LINUX_X64;
      }
      if (arch === "arm64") {
        return TargetPlatform.LINUX_ARM64;
      }
      if (arch === "arm") {
        return TargetPlatform.LINUX_ARMHF;
      }
      return TargetPlatform.UNKNOWN;

    case "alpine":
      if (arch === "x64") {
        return TargetPlatform.ALPINE_X64;
      }
      if (arch === "arm64") {
        return TargetPlatform.ALPINE_ARM64;
      }
      return TargetPlatform.UNKNOWN;

    case Platform.Mac:
      if (arch === "x64") {
        return TargetPlatform.DARWIN_X64;
      }
      if (arch === "arm64") {
        return TargetPlatform.DARWIN_ARM64;
      }
      return TargetPlatform.UNKNOWN;
  }
}

async function isAlpineLinux(): Promise<boolean> {
  if (!isLinux) {
    return false;
  }
  let content: string | undefined;
  try {
    const fileContent = await fs.readFile("/etc/os-release");
    content = fileContent.toString();
  } catch (error) {
    try {
      const fileContent = await fs.readFile("/usr/lib/os-release");
      content = fileContent.toString();
    } catch (error) {
      /* Ignore */
      console.debug(`Error while getting the os-release file.`, error);
    }
  }
  return (
    !!content && (content.match(/^ID=([^\u001b\r\n]*)/m) || [])[1] === "alpine"
  );
}

export async function computeTargetPlatform(): Promise<TargetPlatform> {
  const alpineLinux = await isAlpineLinux();
  const targetPlatform = getTargetPlatform(
    alpineLinux ? "alpine" : platform,
    process.arch
  );
  console.debug("ComputeTargetPlatform:", targetPlatform);
  return targetPlatform;
}

async function extractFile(filename: string) {
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

    const extract = tarStream.extract();

    const extractionPromise = new Promise((resolve, reject) => {
      extract.on("entry", async (header, stream, next) => {
        const filePath = join(targetDirectory, header.name);

        // Ensure the directory exists
        await fsExtra.ensureDir(dirname(filePath));

        stream.pipe(createWriteStream(filePath));

        stream.on("end", function () {
          next(); // ready for next entry
        });

        stream.resume(); // just auto drain the stream
      });

      extract.on("finish", () => {
        console.log("Extraction complete");
      });
    });

    createReadStream(tarFilePath).pipe(zlib.createGunzip()).pipe(extract);

    await extractionPromise;
  } catch (error) {
    console.error(error);
  }
}

/*
 * Function used programmatically to trigger an analysis.
 */
export async function scan() {
  console.log("Starting analysis...");
  let responsePipe = null;
  // first get platform.
  try {
    console.log({
      platform: PlatformToString(platform),
    });
    await computeTargetPlatform();
  } catch (error) {
    console.error(error);
  }

  const filename = `OpenJDK21U-jre_${archToString(
    process.arch
  )}_${PlatformToString(platform).toLowerCase()}_hotspot_21.0.2_13.tar.gz`;

  // then download the file.
  try {
    if (!existsSync(filename)) {
      console.log(
        `download from https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.2%2B13/${filename}`
      );
      await new Promise((resolve, reject) => {
        axios({
          method: "get",
          url: `https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.2%2B13/${filename}`,
          responseType: "stream",
        }).then(function (response) {
          const stream = response.data.pipe(createWriteStream(filename));
          stream.on("finish", () => {
            console.log("Stream Finished");
            resolve(null);
          });
          stream.on("error", (error: unknown) => {
            console.log("Stream Error", error);
            reject(error);
          });
          stream.on("close", () => {
            console.log("Stream Closed");
          });
        });
      });
    } else {
      console.log("File already exists.");
    }

    console.log("Extracting File...");
    await extractFile(filename);
  } catch (error) {
    console.error(error);
  } finally {
    console.log("Analysis finished.");
  }
}

//TODO: remove, to be handled by api
function archToString(arch: string) {
  if (arch === "arm64") {
    return "aarch64";
  } else if (arch === "arm") {
    return "aarch32";
  }

  return arch;
}
