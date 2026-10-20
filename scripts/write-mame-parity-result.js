import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const [logArgument, resultArgument] = process.argv.slice(2);

if (logArgument === undefined || resultArgument === undefined) {
    throw new Error("Usage: write-mame-parity-result.js <native.log> <result.json>");
}

const log = readFileSync(resolve(logArgument), "utf8");
const frame = log.match(/P12_FRAME machine=(\S+) frame=(\d+) width=(\d+) height=(\d+) visible=(\d+)x(\d+) refresh_millihz=(\d+) checksum=([0-9a-f]{8}) nonblack=(\d+)/);
const input = log.match(/P12_INPUT found=(\d+) initially_released=(\d+) pressed=(\d+) released=(\d+)/);

if (frame === null || input === null) {
    throw new Error("Native parity output did not contain complete frame and input records");
}

const result = {
    frame: {
        machine: frame[1],
        frame: Number(frame[2]),
        width: Number(frame[3]),
        height: Number(frame[4]),
        visibleWidth: Number(frame[5]),
        visibleHeight: Number(frame[6]),
        refreshMilliHz: Number(frame[7]),
        checksum: frame[8],
        nonBlackPixels: Number(frame[9]),
    },
    input: {
        found: input[1] === "1",
        initiallyReleased: input[2] === "1",
        pressed: input[3] === "1",
        released: input[4] === "1",
    },
};

const resultPath = resolve(resultArgument);
mkdirSync(dirname(resultPath), { recursive: true });
writeFileSync(resultPath, `${JSON.stringify(result, null, 2)}\n`);
