import Foundation
import Capacitor
import WidgetKit

@objc(WidgetDataPlugin)
public class WidgetDataPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WidgetDataPlugin"
    public let jsName = "WidgetData"
    public let pluginMethods: [CAPPluginMethod] = [CAPPluginMethod(name: "save", returnType: CAPPluginReturnPromise)]

    @objc func save(_ call: CAPPluginCall) {
        guard let json = call.getString("json"), let defaults = UserDefaults(suiteName: "group.cz.honzikovamoudra.app") else {
            call.reject("APP_GROUP_UNAVAILABLE")
            return
        }
        defaults.set(json, forKey: "daily-plan-v1")
        defaults.set(Date().timeIntervalSince1970, forKey: "daily-plan-saved-at")
        WidgetCenter.shared.reloadTimelines(ofKind: "HonzikovaMoudraWidget")
        call.resolve()
    }
}
