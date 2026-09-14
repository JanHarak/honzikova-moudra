import xcode from "xcode";
import fs from "node:fs";

const file = "ios/App/App.xcodeproj/project.pbxproj";
const project = xcode.project(file);
project.parseSync();

const appTarget = project.getFirstTarget().uuid;
const appGroup = project.findPBXGroupKey({ path: "App" });
if (project.hasFile("App/WidgetDataPlugin.swift"))
  project.removeSourceFile("App/WidgetDataPlugin.swift", {}, appGroup);
if (!project.hasFile("WidgetDataPlugin.swift"))
  project.addSourceFile("WidgetDataPlugin.swift", {}, appGroup);

let widgetKey =
  project.findTargetKey("HonzikovaMoudraWidget") ||
  project.findTargetKey('"HonzikovaMoudraWidget"');
if (!widgetKey) {
  const widget = project.addTarget(
    "HonzikovaMoudraWidget",
    "app_extension",
    "HonzikovaMoudraWidget",
    "cz.honzikovamoudra.app.widget",
  );
  widgetKey = widget.uuid;
  project.addBuildPhase(
    ["HonzikovaMoudraWidget/HonzikovaMoudraWidget.swift"],
    "PBXSourcesBuildPhase",
    "Sources",
    widgetKey,
  );
  project.addBuildPhase(
    ["HonzikovaMoudraWidget/Assets.xcassets"],
    "PBXResourcesBuildPhase",
    "Resources",
    widgetKey,
  );
}

const configurations = project.pbxXCBuildConfigurationSection();
for (const [key, configuration] of Object.entries(configurations)) {
  if (key.endsWith("_comment") || !configuration?.buildSettings) continue;
  const settings = configuration.buildSettings;
  const info = String(settings.INFOPLIST_FILE || "");
  if (info.includes("App/Info.plist")) {
    settings.CODE_SIGN_ENTITLEMENTS = "App/App.entitlements";
  } else if (info.includes("HonzikovaMoudraWidget-Info.plist")) {
    settings.INFOPLIST_FILE =
      "HonzikovaMoudraWidget/HonzikovaMoudraWidget-Info.plist";
    settings.CODE_SIGN_ENTITLEMENTS =
      "HonzikovaMoudraWidget/HonzikovaMoudraWidget.entitlements";
    settings.IPHONEOS_DEPLOYMENT_TARGET = "15.0";
    settings.SWIFT_VERSION = "5.0";
    settings.TARGETED_DEVICE_FAMILY = '"1,2"';
    settings.MARKETING_VERSION = "1.0";
    settings.CURRENT_PROJECT_VERSION = "1";
    settings.CODE_SIGN_STYLE = "Automatic";
  }
}

fs.writeFileSync(file, project.writeSync());
console.log(
  `Configured widget target ${widgetKey} and App Group entitlements (${appTarget}).`,
);
