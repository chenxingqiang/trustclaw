import Foundation
import OSLog

/// Installs bundled TrustClaw OpenClaw state from app Resources on first launch (or app upgrade).
enum TrustClawBundledStateInstaller {
    private static let bundledDirName = "trustclaw-bundled-state"
    private static let markerFileName = ".trustclaw-bundled-version"
    private static let agentsPlaceholder = "__TRUSTCLAW_BUNDLED_AGENTS_DIR__"
    private static let logger = Logger(subsystem: "ai.openclaw", category: "trustclaw.bundled-state")

    static func installIfNeeded() {
        guard let resourcesRoot = Bundle.main.resourceURL else { return }
        let bundledRoot = resourcesRoot.appendingPathComponent(self.bundledDirName, isDirectory: true)
        guard FileManager.default.fileExists(atPath: bundledRoot.path) else { return }

        let stateDir = OpenClawPaths.stateDirURL
        let configURL = stateDir.appendingPathComponent("openclaw.json")
        let markerURL = stateDir.appendingPathComponent(self.markerFileName)
        let bundleVersion = self.readBundleVersion(from: bundledRoot) ?? "unknown"
        let installedVersion = (try? String(contentsOf: markerURL, encoding: .utf8))?.trimmingCharacters(in: .whitespacesAndNewlines)

        let shouldInstall = !FileManager.default.fileExists(atPath: configURL.path) || installedVersion != bundleVersion
        guard shouldInstall else { return }

        do {
            try FileManager.default.createDirectory(at: stateDir, withIntermediateDirectories: true)
            try self.copyBundledState(from: bundledRoot, to: stateDir, resourcesRoot: resourcesRoot)
            try self.patchBundledConfig(at: configURL, resourcesRoot: resourcesRoot)
            try bundleVersion.write(to: markerURL, atomically: true, encoding: .utf8)
            self.installConnectShortcut(from: bundledRoot)
            self.logger.info("Installed bundled TrustClaw state version=\(bundleVersion, privacy: .public)")
        } catch {
            self.logger.error("Failed to install bundled TrustClaw state: \(error.localizedDescription, privacy: .public)")
        }
    }

    private static func readBundleVersion(from bundledRoot: URL) -> String? {
        let manifestURL = bundledRoot.appendingPathComponent("manifest.json")
        guard let data = try? Data(contentsOf: manifestURL),
              let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let version = root["bundleVersion"] as? String,
              !version.isEmpty
        else {
            return Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String
        }
        return version
    }

    private static func copyBundledState(from bundledRoot: URL, to stateDir: URL, resourcesRoot: URL) throws {
        let skipNames: Set<String> = ["manifest.json"]
        let entries = try FileManager.default.contentsOfDirectory(at: bundledRoot, includingPropertiesForKeys: nil)
        for entry in entries {
            if skipNames.contains(entry.lastPathComponent) { continue }
            let dest = stateDir.appendingPathComponent(entry.lastPathComponent)
            if FileManager.default.fileExists(atPath: dest.path) {
                try FileManager.default.removeItem(at: dest)
            }
            try FileManager.default.copyItem(at: entry, to: dest)
        }

        let bundledAgents = resourcesRoot.appendingPathComponent("trustclaw/agents", isDirectory: true)
        if FileManager.default.fileExists(atPath: bundledAgents.path) {
            self.logger.debug("Bundled agent packs present at \(bundledAgents.path, privacy: .public)")
        }
    }

    private static func patchBundledConfig(at configURL: URL, resourcesRoot: URL) throws {
        guard FileManager.default.fileExists(atPath: configURL.path) else { return }
        let data = try Data(contentsOf: configURL)
        guard var root = try JSONSerialization.jsonObject(with: data) as? [String: Any] else { return }

        let agentsDir = resourcesRoot.appendingPathComponent("trustclaw/agents", isDirectory: true).path
        var plugins = root["plugins"] as? [String: Any] ?? [:]
        var entries = plugins["entries"] as? [String: Any] ?? [:]
        var tra = entries["trustclaw-tra"] as? [String: Any] ?? [:]
        var pluginConfig = tra["config"] as? [String: Any] ?? [:]
        pluginConfig["agentPacksDir"] = agentsDir
        tra["config"] = pluginConfig
        entries["trustclaw-tra"] = tra
        plugins["entries"] = entries
        root["plugins"] = plugins

        let encoded = try JSONSerialization.data(withJSONObject: root, options: [.prettyPrinted, .sortedKeys])
        var json = String(data: encoded, encoding: .utf8) ?? ""
        json = json.replacingOccurrences(of: self.agentsPlaceholder, with: agentsDir)
        try json.write(to: configURL, atomically: true, encoding: .utf8)
    }

    private static func installConnectShortcut(from bundledRoot: URL) {
        let connectSrc = bundledRoot.appendingPathComponent("trustclaw-connect.url")
        guard FileManager.default.fileExists(atPath: connectSrc.path) else { return }
        guard let desktop = FileManager.default.urls(for: .desktopDirectory, in: .userDomainMask).first else {
            return
        }
        let dest = desktop.appendingPathComponent("TrustClaw Connect.url")
        if FileManager.default.fileExists(atPath: dest.path) {
            try? FileManager.default.removeItem(at: dest)
        }
        do {
            try FileManager.default.copyItem(at: connectSrc, to: dest)
            self.logger.info("Installed desktop connect shortcut at \(dest.path, privacy: .public)")
        } catch {
            self.logger.error("Failed to install desktop connect shortcut: \(error.localizedDescription, privacy: .public)")
        }
    }
}
