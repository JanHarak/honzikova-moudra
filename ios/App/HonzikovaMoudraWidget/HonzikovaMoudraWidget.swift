import WidgetKit
import SwiftUI

private let group = "group.cz.honzikovamoudra.app"

struct DailyQuote: Codable {
    let date: String
    let quote_id: String
    let text: String
    let revision: Int
    let valid_from: String
    let valid_until: String
}

struct QuoteEntry: TimelineEntry {
    let date: Date
    let quote: DailyQuote?
    let stale: Bool
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> QuoteEntry { QuoteEntry(date: .now, quote: nil, stale: false) }
    func getSnapshot(in context: Context, completion: @escaping (QuoteEntry) -> Void) { completion(entries().first ?? placeholder(in: context)) }
    func getTimeline(in context: Context, completion: @escaping (Timeline<QuoteEntry>) -> Void) {
        let values = entries()
        let refresh = values.last.map { Calendar(identifier: .gregorian).date(byAdding: .hour, value: 1, to: $0.date)! } ?? Date().addingTimeInterval(3600)
        completion(Timeline(entries: values, policy: .after(refresh)))
    }

    private func entries(now: Date = .now) -> [QuoteEntry] {
        guard let defaults = UserDefaults(suiteName: group),
              let json = defaults.string(forKey: "daily-plan-v1"),
              let data = json.data(using: .utf8),
              let plan = try? JSONDecoder().decode([DailyQuote].self, from: data), !plan.isEmpty else {
            return [QuoteEntry(date: now, quote: nil, stale: false)]
        }
        let iso = ISO8601DateFormatter()
        let upcoming = plan.compactMap { item -> QuoteEntry? in
            guard let start = iso.date(from: item.valid_from), let end = iso.date(from: item.valid_until), end > now else { return nil }
            return QuoteEntry(date: max(start, now), quote: item, stale: false)
        }
        if !upcoming.isEmpty { return upcoming }
        let saved = Date(timeIntervalSince1970: defaults.double(forKey: "daily-plan-saved-at"))
        return [QuoteEntry(date: now, quote: plan.last, stale: now.timeIntervalSince(saved) > 86400)]
    }
}

struct WidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: QuoteEntry
    var body: some View {
        VStack(spacing: 8) {
            HStack { Image("Owl").resizable().scaledToFit().frame(width: 28, height: 32); Text("Honzíkova moudra").font(.caption.bold()); Spacer() }
            Spacer(minLength: 0)
            if let quote = entry.quote {
                Text("„\(quote.text)“").font(.system(family == .systemSmall ? .headline : .title3, design: .serif, weight: .bold)).multilineTextAlignment(.center).lineLimit(family == .systemSmall ? 4 : 3).minimumScaleFactor(0.72)
                if entry.stale { Text("Obsah může být zastaralý").font(.caption2).foregroundStyle(.secondary) }
            } else {
                Text("Otevři aplikaci a načti moudro dne.").font(.callout).multilineTextAlignment(.center).foregroundStyle(.secondary)
            }
            Spacer(minLength: 0)
        }
        .padding()
        .widgetCardBackground()
        .widgetURL(entry.quote.flatMap { URL(string: "honzikovamoudra://moudra/\($0.quote_id)") })
    }
}

extension View {
    @ViewBuilder func widgetCardBackground() -> some View {
        if #available(iOSApplicationExtension 17.0, *) {
            containerBackground(for: .widget) { Color(uiColor: .secondarySystemBackground) }
        } else {
            background(Color(uiColor: .secondarySystemBackground))
        }
    }
}

@main struct HonzikovaMoudraWidget: Widget {
    let kind = "HonzikovaMoudraWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { WidgetView(entry: $0) }
            .configurationDisplayName("Moudro dne")
            .description("Honzíkovo moudro pro dnešní den.")
            .supportedFamilies([.systemSmall, .systemMedium])
    }
}
