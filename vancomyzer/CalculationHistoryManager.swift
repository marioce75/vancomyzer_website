import Foundation
import SwiftUI

// MARK: - Calculation History Manager

@MainActor
class CalculationHistoryManager: ObservableObject {
    static let shared = CalculationHistoryManager()
    
    @Published var calculations: [CalculationRecord] = []
    @Published var isLoading = false
    @Published var searchText = ""
    @Published var selectedPopulation: PopulationType?
    @Published var selectedDateRange: DateRange = .all
    
    private let userDefaults = UserDefaults.standard
    private let historyKey = "calculation_history"
    private let maxHistoryCount = 100
    
    enum DateRange: String, CaseIterable {
        case all = "all"
        case today = "today"
        case week = "week"
        case month = "month"
        
        var displayName: String {
            switch self {
            case .all: return NSLocalizedString("date_range.all", comment: "All Time")
            case .today: return NSLocalizedString("date_range.today", comment: "Today")
            case .week: return NSLocalizedString("date_range.week", comment: "This Week")
            case .month: return NSLocalizedString("date_range.month", comment: "This Month")
            }
        }
        
        var dateFilter: (Date) -> Bool {
            let now = Date()
            let calendar = Calendar.current
            
            switch self {
            case .all:
                return { _ in true }
            case .today:
                return { date in
                    calendar.isDate(date, inSameDayAs: now)
                }
            case .week:
                return { date in
                    let weekAgo = calendar.date(byAdding: .day, value: -7, to: now) ?? now
                    return date >= weekAgo
                }
            case .month:
                return { date in
                    let monthAgo = calendar.date(byAdding: .month, value: -1, to: now) ?? now
                    return date >= monthAgo
                }
            }
        }
    }
    
    private init() {
        loadCalculationHistory()
    }
    
    // MARK: - Public Methods
    
    func saveCalculation(_ result: DosingResult, for patient: PatientInput) {
        let record = CalculationRecord(
            id: UUID(),
            patient: patient,
            result: result,
            timestamp: Date()
        )
        
        calculations.insert(record, at: 0)
        
        // Limit history size
        if calculations.count > maxHistoryCount {
            calculations = Array(calculations.prefix(maxHistoryCount))
        }
        
        saveToStorage()
        
        // Update user preferences
        let userPrefs = UserPreferences()
        userPrefs.calculationCount += 1
        userPrefs.lastCalculationDate = Date()
        
        // Track analytics
        AnalyticsManager.shared.trackFeatureUsage("calculation_saved", parameters: [
            "population": patient.populationType.rawValue,
            "method": result.calculationMethod
        ])
    }
    
    func deleteCalculation(at index: Int) {
        guard index < calculations.count else { return }
        calculations.remove(at: index)
        saveToStorage()
        
        AnalyticsManager.shared.trackFeatureUsage("calculation_deleted")
    }
    
    func deleteCalculations(at offsets: IndexSet) {
        calculations.remove(atOffsets: offsets)
        saveToStorage()
        
        AnalyticsManager.shared.trackFeatureUsage("calculations_bulk_deleted", parameters: [
            "count": offsets.count
        ])
    }
    
    func clearAllHistory() {
        calculations.removeAll()
        saveToStorage()
        
        AnalyticsManager.shared.trackFeatureUsage("history_cleared")
    }
    
    func exportHistory() -> [CalculationRecord] {
        return filteredCalculations
    }
    
    // MARK: - Filtering
    
    var filteredCalculations: [CalculationRecord] {
        var filtered = calculations
        
        // Date range filter
        if selectedDateRange != .all {
            filtered = filtered.filter { selectedDateRange.dateFilter($0.timestamp) }
        }
        
        // Population filter
        if let population = selectedPopulation {
            filtered = filtered.filter { $0.patient.populationType == population }
        }
        
        // Search filter
        if !searchText.isEmpty {
            filtered = filtered.filter { record in
                record.searchableText.localizedCaseInsensitiveContains(searchText)
            }
        }
        
        return filtered
    }
    
    // MARK: - Statistics
    
    var statisticsSummary: HistoryStatistics {
        return HistoryStatistics(records: calculations)
    }
    
    // MARK: - Private Methods
    
    private func loadCalculationHistory() {
        isLoading = true
        
        DispatchQueue.global(qos: .background).async { [weak self] in
            if let data = self?.userDefaults.data(forKey: self?.historyKey ?? ""),
               let records = try? JSONDecoder().decode([CalculationRecord].self, from: data) {
                
                DispatchQueue.main.async {
                    self?.calculations = records
                    self?.isLoading = false
                }
            } else {
                DispatchQueue.main.async {
                    self?.calculations = []
                    self?.isLoading = false
                }
            }
        }
    }
    
    private func saveToStorage() {
        DispatchQueue.global(qos: .background).async { [weak self] in
            if let data = try? JSONEncoder().encode(self?.calculations) {
                self?.userDefaults.set(data, forKey: self?.historyKey ?? "")
            }
        }
    }
}

// MARK: - Calculation Record

struct CalculationRecord: Codable, Identifiable, Equatable {
    let id: UUID
    let patient: PatientInput
    let result: DosingResult
    let timestamp: Date
    
    // For search functionality
    var searchableText: String {
        let patientText = "\(patient.populationType.rawValue) \(patient.indication.rawValue) \(patient.severity.rawValue)"
        let resultText = result.calculationMethod
        let notesText = result.clinicalNotes.joined(separator: " ")
        
        return "\(patientText) \(resultText) \(notesText)".lowercased()
    }
    
    // Display formatting
    var displayTitle: String {
        return "\(patient.populationType.localizedName) Patient"
    }
    
    var displaySubtitle: String {
        return "\(patient.indication.localizedName) (\(patient.severity.localizedName))"
    }
    
    var displayTimestamp: String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: timestamp, relativeTo: Date())
    }
    
    var displaySummary: String {
        return result.dosingSummary
    }
}

// MARK: - History Statistics

struct HistoryStatistics {
    let totalCalculations: Int
    let populationBreakdown: [PopulationType: Int]
    let indicationBreakdown: [Indication: Int]
    let methodBreakdown: [String: Int]
    let averageAUC: Double
    let averageDose: Double
    let dateRange: DateInterval?
    
    init(records: [CalculationRecord]) {
        totalCalculations = records.count
        
        // Population breakdown
        var popBreakdown: [PopulationType: Int] = [:]
        for record in records {
            popBreakdown[record.patient.populationType, default: 0] += 1
        }
        populationBreakdown = popBreakdown
        
        // Indication breakdown
        var indBreakdown: [Indication: Int] = [:]
        for record in records {
            indBreakdown[record.patient.indication, default: 0] += 1
        }
        indicationBreakdown = indBreakdown
        
        // Method breakdown
        var methodBreakdown: [String: Int] = [:]
        for record in records {
            methodBreakdown[record.result.calculationMethod, default: 0] += 1
        }
        self.methodBreakdown = methodBreakdown
        
        // Averages
        if !records.isEmpty {
            averageAUC = records.map { $0.result.predictedAUC }.reduce(0, +) / Double(records.count)
            averageDose = records.map { $0.result.dailyDose }.reduce(0, +) / Double(records.count)
        } else {
            averageAUC = 0
            averageDose = 0
        }
        
        // Date range
        if let earliest = records.map({ $0.timestamp }).min(),
           let latest = records.map({ $0.timestamp }).max() {
            dateRange = DateInterval(start: earliest, end: latest)
        } else {
            dateRange = nil
        }
    }
}

// MARK: - Export Manager

class HistoryExportManager {
    static let shared = HistoryExportManager()
    
    private init() {}
    
    func exportAsCSV(_ records: [CalculationRecord]) -> String {
        var csv = "Timestamp,Population,Age,Weight,Height,SCr,Indication,Severity,Method,Dose,Interval,Daily Dose,AUC,Trough,Peak,Clearance,Volume,Half-life\n"
        
        let formatter = ISO8601DateFormatter()
        
        for record in records {
            let patient = record.patient
            let result = record.result
            
            let row = [
                formatter.string(from: record.timestamp),
                patient.populationType.rawValue,
                patient.ageDisplay,
                String(patient.weightInKg),
                String(patient.heightInCm ?? 0),
                String(patient.serumCreatinine),
                patient.indication.rawValue,
                patient.severity.rawValue,
                result.calculationMethod,
                String(result.recommendedDose),
                String(result.interval),
                String(format: "%.1f", result.dailyDose),
                String(format: "%.1f", result.predictedAUC),
                String(format: "%.1f", result.predictedTrough),
                String(format: "%.1f", result.predictedPeak),
                String(format: "%.2f", result.clearance),
                String(format: "%.1f", result.volumeDistribution),
                String(format: "%.1f", result.halfLife)
            ].joined(separator: ",")
            
            csv += row + "\n"
        }
        
        return csv
    }
    
    func exportAsJSON(_ records: [CalculationRecord]) -> String {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        
        if let data = try? encoder.encode(records),
           let json = String(data: data, encoding: .utf8) {
            return json
        }
        
        return "{\"error\": \"Failed to encode data\"}"
    }
    
    func shareCalculation(_ record: CalculationRecord) -> String {
        let patient = record.patient
        let result = record.result
        let timestamp = DateFormatter.calculationTimestamp.string(from: record.timestamp)
        
        return """
        Vancomyzer Calculation Result
        
        Date: \(timestamp)
        Patient: \(patient.clinicalSummary)
        Indication: \(patient.indication.localizedName) (\(patient.severity.localizedName))
        
        Recommended Dosing: \(result.dosingSummary)
        
        Predicted Parameters:
        • AUC₀₋₂₄: \(result.aucDisplay)
        • Trough: \(result.troughDisplay)
        • Peak: \(result.peakDisplay)
        • Half-life: \(result.halfLifeDisplay)
        
        Method: \(result.calculationMethod)
        Reference: \(result.guidelineReference)
        
        Generated by Vancomyzer
        """
    }
}