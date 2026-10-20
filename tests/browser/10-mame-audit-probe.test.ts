// realizes: docs/mame-game-runtime-spec.md > §13.1 P11 audit output

// Dependencies:
import CTGBrowserTest from "ctg-js-browser-test";                // Browser pipeline over Playwright

// Type dependencies:
import type { Page } from "playwright";                          // Page used by shared probe interactions
import type { TestFile } from "../run.ts";                       // Manifest contract consumed by the runner

/**
 *
 * Type Declarations
 *
 */

interface AuditOutputMessage {
    channel: string;
    sequence: number;
    text: string;
}

interface AuditProbeResult {
    capturedBeforeFrontendReturn: boolean;
    dependencyMentioned: boolean;
    errorRecords: number;
    frontendResult: number;
    mainLoopTicks: number;
    missingRecordIndex: number;
    missingRecords: number;
    omissionApplied: boolean;
    outputRecords: number;
    role: string;
    terminalRecordIndex: number;
}

interface AuditProbeApi {
    auditOmissionApplied?: boolean;
    auditOutputCountAtFrontendReturn?: number;
    auditOutputMessages?: AuditOutputMessage[];
    auditProbeResult?: AuditProbeResult;
    frontendResult?: number;
    expectedDependency?: string;
    mainLoopTicks?: number;
}

interface AuditFixture {
    artifact: string;
    role: "BIOS" | "parent";
}

/**
 *
 * Constants
 *
 */

const PROBE_BASE_URL = process.env.MAME_AUDIT_PROBE_BASE_URL;
const MISSING_FILES_RESULT = 2;
const FIXTURES: AuditFixture[] = [
    { artifact: "mameaudit-parent-probe.html", role: "parent" },
    { artifact: "mameaudit-bios-probe.html", role: "BIOS" },
];

/**
 *
 * Functions
 *
 */

// HELPER :: STRING -> STRING
// Resolves a generic artifact under the one configured local probe directory.
const fixtureUrl = (artifact: string): string => {
    const base = PROBE_BASE_URL!.endsWith("/") ? PROBE_BASE_URL! : `${PROBE_BASE_URL!}/`;
    const url = new URL(artifact, base);
    url.searchParams.set("mame_probe_omit", "dependency");
    return url.href;
};

// HELPER :: page -> PROMISE(VOID)
// Waits until MAME has reported the fatal audit result and returned its status.
const waitForAuditResult = async (page: Page): Promise<void> => {
    await page.waitForFunction(() => {
        const probe = (window as typeof window & { JSMESS?: AuditProbeApi }).JSMESS;
        return probe?.auditOmissionApplied === true
            && probe.frontendResult === 2
            && probe.auditOutputMessages?.some((message) =>
                message.channel === "error"
                && message.text.includes("Required files are missing")) === true;
    }, undefined, { timeout: 30_000 });
};

const testFile: TestFile = {
    label: "MAME 0.161 browser audit-output probe",
    skip: PROBE_BASE_URL === undefined
        ? "set MAME_AUDIT_PROBE_BASE_URL to the directory containing the generic audit probes"
        : undefined,
    cases: FIXTURES.map((fixture) => ({
        label: `reports a missing ${fixture.role} dependency before frontend return`,
        run: () => CTGBrowserTest.init(`missing ${fixture.role} audit dependency`)
            .interact("wait for the expected audit failure", async ({ page }) =>
                await waitForAuditResult(page))
            .interact("summarize structured output without exposing fixture names", async ({ page }) => {
                const result = await page.evaluate((role) => {
                    const probe = (window as typeof window & { JSMESS: AuditProbeApi }).JSMESS;
                    const messages = probe.auditOutputMessages ?? [];
                    const expectedDependency = probe.expectedDependency ?? "";
                    const missing = messages.filter((message) =>
                        message.channel === "error" && message.text.includes(" NOT FOUND"));
                    const missingRecordIndex = messages.findIndex((message) =>
                        message.channel === "error" && message.text.includes(" NOT FOUND"));
                    const terminalRecordIndex = messages.findIndex((message) =>
                        message.channel === "error"
                        && message.text.includes("Required files are missing"));
                    return {
                        capturedBeforeFrontendReturn: terminalRecordIndex >= 0
                            && terminalRecordIndex < (probe.auditOutputCountAtFrontendReturn ?? 0),
                        dependencyMentioned: expectedDependency.length > 0
                            && missing.some((message) => message.text.includes(expectedDependency)),
                        errorRecords: messages.filter((message) => message.channel === "error").length,
                        frontendResult: probe.frontendResult ?? -1,
                        mainLoopTicks: probe.mainLoopTicks ?? 0,
                        missingRecordIndex,
                        missingRecords: missing.length,
                        omissionApplied: probe.auditOmissionApplied === true,
                        outputRecords: messages.length,
                        role,
                        terminalRecordIndex,
                    } satisfies AuditProbeResult;
                }, fixture.role);
                await page.evaluate((value) => {
                    (window as typeof window & { JSMESS: AuditProbeApi }).JSMESS.auditProbeResult = value;
                }, result);
                console.log(`AUDIT_RESULT ${JSON.stringify(result)}`);
            })
            .assertPage(
                "the dependency-specific missing records precede the terminal error",
                async (page) => await page.evaluate(() => {
                    const result = (window as typeof window & { JSMESS?: AuditProbeApi })
                        .JSMESS?.auditProbeResult;
                    return result?.omissionApplied === true
                        && result.missingRecords > 0
                        && result.dependencyMentioned
                        && result.missingRecordIndex >= 0
                        && result.terminalRecordIndex > result.missingRecordIndex;
                }),
                true,
            )
            .assertPage(
                "the OSD errors are complete before the frontend returns missing-files status",
                async (page) => await page.evaluate((expectedStatus) => {
                    const result = (window as typeof window & { JSMESS?: AuditProbeApi })
                        .JSMESS?.auditProbeResult;
                    return result?.frontendResult === expectedStatus
                        && result.errorRecords >= 2
                        && result.capturedBeforeFrontendReturn
                        && result.outputRecords >= result.errorRecords
                        && result.mainLoopTicks === 0;
                }, MISSING_FILES_RESULT),
                true,
            )
            .start(fixtureUrl(fixture.artifact), { headless: true }),
    })),
};

export default testFile;
