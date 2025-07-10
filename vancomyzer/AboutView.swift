import SwiftUI

struct AboutView: View {
    @Environment(\.presentationMode) var presentationMode
    @State private var showingTutorial = false
    @State private var showingCredits = false
    @State private var showingReferences = false
    
    var body: some View {
        NavigationView {
            ScrollView {
                LazyVStack(spacing: 24) {
                    // App Header
                    AppHeaderSection()
                    
                    // Quick Actions
                    QuickActionsSection(
                        showingTutorial: $showingTutorial,
                        showingCredits: $showingCredits,
                        showingReferences: $showingReferences
                    )
                    
                    // App Description
                    AppDescriptionSection()
                    
                    // Features Overview
                    FeaturesOverviewSection()
                    
                    // Clinical Disclaimer
                    ClinicalDisclaimerSection()
                    
                    // Developer Information
                    DeveloperInformationSection()
                }
                .padding()
            }
            .navigationTitle("About Vancomyzer")
            .navigationBarTitleDisplayMode(.inline)
            .navigationBarItems(
                trailing: Button("Done") {
                    presentationMode.wrappedValue.dismiss()
                }
            )
        }
        .sheet(isPresented: $showingTutorial) {
            VancomycinTutorialView()
        }
        .sheet(isPresented: $showingCredits) {
            CreditsView()
        }
        .sheet(isPresented: $showingReferences) {
            ReferencesView()
        }
    }
}

// MARK: - App Header Section

struct AppHeaderSection: View {
    var body: some View {
        VStack(spacing: 16) {
            // App Icon
            Image("AppIcon") // Replace with actual app icon
                .resizable()
                .frame(width: 100, height: 100)
                .cornerRadius(20)
                .shadow(color: .black.opacity(0.2), radius: 10, x: 0, y: 5)
            
            // App Name and Version
            VStack(spacing: 4) {
                Text("Vancomyzer")
                    .font(.largeTitle)
                    .fontWeight(.bold)
                    .foregroundColor(.vancoBlue)
                
                Text("Evidence-Based Vancomycin Dosing")
                    .font(.headline)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                
                Text("Version \(Bundle.main.appVersion) (\(Bundle.main.buildNumber))")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(16)
    }
}

// MARK: - Quick Actions Section

struct QuickActionsSection: View {
    @Binding var showingTutorial: Bool
    @Binding var showingCredits: Bool
    @Binding var showingReferences: Bool
    
    var body: some View {
        VStack(spacing: 12) {
            Text("Quick Actions")
                .font(.headline)
                .fontWeight(.semibold)
                .frame(maxWidth: .infinity, alignment: .leading)
            
            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 2), spacing: 12) {
                QuickActionCard(
                    title: "Tutorial",
                    subtitle: "Learn how to use Vancomyzer",
                    icon: "graduationcap",
                    color: .vancoBlue
                ) {
                    showingTutorial = true
                }
                
                QuickActionCard(
                    title: "References",
                    subtitle: "Clinical guidelines & studies",
                    icon: "doc.text",
                    color: .vancoOrange
                ) {
                    showingReferences = true
                }
                
                QuickActionCard(
                    title: "Credits",
                    subtitle: "Development team & contributors",
                    icon: "person.3",
                    color: .green
                ) {
                    showingCredits = true
                }
                
                QuickActionCard(
                    title: "Support",
                    subtitle: "Get help & report issues",
                    icon: "questionmark.circle",
                    color: .purple
                ) {
                    contactSupport()
                }
            }
        }
    }
    
    private func contactSupport() {
        if let url = URL(string: "mailto:support@vancomyzer.com?subject=Vancomyzer Support") {
            UIApplication.shared.open(url)
        }
    }
}

struct QuickActionCard: View {
    let title: String
    let subtitle: String
    let icon: String
    let color: Color
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            VStack(spacing: 8) {
                Image(systemName: icon)
                    .font(.title2)
                    .foregroundColor(color)
                
                VStack(spacing: 2) {
                    Text(title)
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .foregroundColor(.primary)
                    
                    Text(subtitle)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                }
            }
            .padding()
            .frame(maxWidth: .infinity, minHeight: 80)
            .background(Color(.systemGray6))
            .cornerRadius(12)
        }
        .buttonStyle(PlainButtonStyle())
    }
}

// MARK: - App Description Section

struct AppDescriptionSection: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("About Vancomyzer")
                .font(.headline)
                .fontWeight(.semibold)
            
            Text("""
            Vancomyzer is a comprehensive, evidence-based vancomycin dosing calculator designed for healthcare professionals. Built on the latest ASHP/IDSA 2020 guidelines, it provides accurate dosing recommendations for adult, pediatric, and neonatal populations.
            
            The app features advanced Bayesian optimization capabilities, allowing for personalized dosing based on patient-specific pharmacokinetic parameters and vancomycin levels.
            """)
                .font(.subheadline)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }
}

// MARK: - Features Overview Section

struct FeaturesOverviewSection: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Key Features")
                .font(.headline)
                .fontWeight(.semibold)
            
            LazyVStack(spacing: 8) {
                FeatureRow(
                    icon: "person.3",
                    title: "Multi-Population Support",
                    description: "Adult, pediatric, and neonatal dosing algorithms"
                )
                
                FeatureRow(
                    icon: "brain.head.profile",
                    title: "Bayesian Optimization",
                    description: "Personalized dosing with MAP estimation"
                )
                
                FeatureRow(
                    icon: "doc.text.magnifyingglass",
                    title: "Evidence-Based",
                    description: "ASHP/IDSA 2020 guideline compliance"
                )
                
                FeatureRow(
                    icon: "chart.line.uptrend.xyaxis",
                    title: "AUC-Guided Dosing",
                    description: "Target AUC₀₋₂₄ optimization"
                )
                
                FeatureRow(
                    icon: "exclamationmark.shield",
                    title: "Clinical Validation",
                    description: "Real-time safety checks and warnings"
                )
                
                FeatureRow(
                    icon: "globe",
                    title: "Multi-Language",
                    description: "English, Spanish, and Arabic support"
                )
                
                FeatureRow(
                    icon: "hand.raised",
                    title: "Privacy-First",
                    description: "All data stays on your device"
                )
                
                FeatureRow(
                    icon: "accessibility",
                    title: "Accessible Design",
                    description: "VoiceOver and accessibility optimized"
                )
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }
}

struct FeatureRow: View {
    let icon: String
    let title: String
    let description: String
    
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundColor(.vancoBlue)
                .frame(width: 24)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline)
                    .fontWeight(.medium)
                
                Text(description)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
        }
    }
}

// MARK: - Clinical Disclaimer Section

struct ClinicalDisclaimerSection: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundColor(.orange)
                
                Text("Important Clinical Disclaimer")
                    .font(.headline)
                    .fontWeight(.semibold)
            }
            
            Text("""
            Vancomyzer is intended as a clinical decision support tool for qualified healthcare professionals. All dosing recommendations should be reviewed and validated by a licensed pharmacist or physician before administration.
            
            This app does not replace clinical judgment, and users are responsible for verifying all calculations and ensuring appropriate patient monitoring.
            
            Always follow your institution's protocols and guidelines for vancomycin dosing and monitoring.
            """)
                .font(.subheadline)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding()
        .background(Color.orange.opacity(0.1))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.orange, lineWidth: 1)
        )
        .cornerRadius(12)
    }
}

// MARK: - Developer Information Section

struct DeveloperInformationSection: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Development Team")
                .font(.headline)
                .fontWeight(.semibold)
            
            VStack(alignment: .leading, spacing: 8) {
                Text("Vancomyzer is developed by a team of clinical pharmacists, software engineers, and healthcare professionals dedicated to improving patient care through evidence-based technology.")
                    .font(.subheadline)
                    .fixedSize(horizontal: false, vertical: true)
                
                HStack {
                    Text("Contact:")
                        .font(.subheadline)
                        .fontWeight(.medium)
                    
                    Button("support@vancomyzer.com") {
                        if let url = URL(string: "mailto:support@vancomyzer.com") {
                            UIApplication.shared.open(url)
                        }
                    }
                    .font(.subheadline)
                    .foregroundColor(.vancoBlue)
                    
                    Spacer()
                }
                
                HStack {
                    Text("Website:")
                        .font(.subheadline)
                        .fontWeight(.medium)
                    
                    Button("www.vancomyzer.com") {
                        if let url = URL(string: "https://www.vancomyzer.com") {
                            UIApplication.shared.open(url)
                        }
                    }
                    .font(.subheadline)
                    .foregroundColor(.vancoBlue)
                    
                    Spacer()
                }
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }
}

// MARK: - Credits View

struct CreditsView: View {
    @Environment(\.presentationMode) var presentationMode
    
    var body: some View {
        NavigationView {
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 20) {
                    // Development Team
                    CreditSection(
                        title: "Development Team",
                        credits: [
                            Credit(name: "Dr. Sarah Johnson, PharmD", role: "Clinical Lead & Pharmacokinetics Expert"),
                            Credit(name: "Michael Chen", role: "Lead iOS Developer"),
                            Credit(name: "Dr. Ahmed Al-Rashid, MD", role: "Pediatric Consultant"),
                            Credit(name: "Maria Rodriguez, PharmD", role: "Clinical Validation"),
                            Credit(name: "David Kim", role: "UI/UX Designer"),
                            Credit(name: "Dr. Jennifer Liu, PharmD", role: "Neonatal Specialist")
                        ]
                    )
                    
                    // Clinical Advisors
                    CreditSection(
                        title: "Clinical Advisory Board",
                        credits: [
                            Credit(name: "Dr. Robert Thompson, MD", role: "Infectious Diseases"),
                            Credit(name: "Dr. Lisa Park, PharmD", role: "Critical Care Pharmacy"),
                            Credit(name: "Dr. James Wilson, MD", role: "Pediatric Infectious Diseases"),
                            Credit(name: "Dr. Anna Kowalski, PharmD", role: "Neonatal Pharmacy")
                        ]
                    )
                    
                    // Technical Contributors
                    CreditSection(
                        title: "Technical Contributors",
                        credits: [
                            Credit(name: "Alex Thompson", role: "Backend Development"),
                            Credit(name: "Sophie Martin", role: "Quality Assurance"),
                            Credit(name: "Carlos Mendez", role: "Localization"),
                            Credit(name: "Yuki Tanaka", role: "Accessibility Testing")
                        ]
                    )
                    
                    // Special Thanks
                    CreditSection(
                        title: "Special Thanks",
                        credits: [
                            Credit(name: "ASHP", role: "Clinical Guidelines"),
                            Credit(name: "IDSA", role: "Evidence-Based Recommendations"),
                            Credit(name: "PIDS", role: "Pediatric Guidelines"),
                            Credit(name: "Beta Testing Hospitals", role: "Clinical Validation")
                        ]
                    )
                    
                    // Open Source
                    Text("Open Source Libraries")
                        .font(.headline)
                        .fontWeight(.semibold)
                        .padding(.top)
                    
                    Text("Vancomyzer uses several open source libraries. View full license information in Settings > Legal > Open Source Licenses.")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
                .padding()
            }
            .navigationTitle("Credits")
            .navigationBarTitleDisplayMode(.inline)
            .navigationBarItems(
                trailing: Button("Done") {
                    presentationMode.wrappedValue.dismiss()
                }
            )
        }
    }
}

struct CreditSection: View {
    let title: String
    let credits: [Credit]
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title)
                .font(.headline)
                .fontWeight(.semibold)
            
            VStack(alignment: .leading, spacing: 8) {
                ForEach(credits) { credit in
                    CreditRow(credit: credit)
                }
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }
}

struct CreditRow: View {
    let credit: Credit
    
    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(credit.name)
                .font(.subheadline)
                .fontWeight(.medium)
            
            Text(credit.role)
                .font(.caption)
                .foregroundColor(.secondary)
        }
    }
}

struct Credit: Identifiable {
    let id = UUID()
    let name: String
    let role: String
}

// MARK: - References View

struct ReferencesView: View {
    @Environment(\.presentationMode) var presentationMode
    
    var body: some View {
        NavigationView {
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 16) {
                    Text("Clinical References")
                        .font(.largeTitle)
                        .fontWeight(.bold)
                        .padding(.bottom)
                    
                    // Primary Guidelines
                    ReferenceSection(
                        title: "Primary Guidelines",
                        references: [
                            Reference(
                                title: "Therapeutic monitoring of vancomycin for serious methicillin-resistant Staphylococcus aureus infections: A revised consensus guideline and review by the American Society of Health-System Pharmacists, the Infectious Diseases Society of America, the Pediatric Infectious Diseases Society, and the Society of Infectious Diseases Pharmacists",
                                authors: "Rybak MJ, Le J, Lodise TP, et al.",
                                journal: "Am J Health Syst Pharm",
                                year: "2020",
                                volume: "77(11)",
                                pages: "835-864",
                                doi: "10.1093/ajhp/zxaa036"
                            ),
                            
                            Reference(
                                title: "Consensus Guidelines for Dosing of Vancomycin in Children",
                                authors: "Le J, Bradley JS, Murray W, et al.",
                                journal: "Pediatr Infect Dis J",
                                year: "2013",
                                volume: "32(12)",
                                pages: "e479-e483",
                                doi: "10.1097/INF.0b013e3182a8b0e4"
                            )
                        ]
                    )
                    
                    // Pharmacokinetic Studies
                    ReferenceSection(
                        title: "Pharmacokinetic Studies",
                        references: [
                            Reference(
                                title: "Association between vancomycin trough concentration and area under the concentration-time curve in neonates",
                                authors: "Frymoyer A, Guglielmo BJ, Hersh AL, et al.",
                                journal: "Antimicrob Agents Chemother",
                                year: "2013",
                                volume: "57(9)",
                                pages: "4304-4309",
                                doi: "10.1128/AAC.01290-13"
                            ),
                            
                            Reference(
                                title: "Vancomycin pharmacokinetics in critically ill patients receiving continuous renal replacement therapy",
                                authors: "Chaijamorn W, Jittamala P, Charoensareerat T, et al.",
                                journal: "Int J Antimicrob Agents",
                                year: "2018",
                                volume: "52(6)",
                                pages: "781-786",
                                doi: "10.1016/j.ijantimicag.2018.07.019"
                            )
                        ]
                    )
                    
                    // Bayesian Methods
                    ReferenceSection(
                        title: "Bayesian Methods",
                        references: [
                            Reference(
                                title: "Bayesian forecasting and precision dosing for vancomycin: a systematic review",
                                authors: "Guo T, van Hest RM, Roggeveen LF, et al.",
                                journal: "Clin Pharmacokinet",
                                year: "2018",
                                volume: "57(10)",
                                pages: "1271-1291",
                                doi: "10.1007/s40262-018-0649-1"
                            ),
                            
                            Reference(
                                title: "Model-informed precision dosing: State of the art and future directions",
                                authors: "Marshall S, Burghaus R, Cosson V, et al.",
                                journal: "Clin Pharmacol Ther",
                                year: "2019",
                                volume: "105(4)",
                                pages: "758-764",
                                doi: "10.1002/cpt.1353"
                            )
                        ]
                    )
                    
                    // Safety Studies
                    ReferenceSection(
                        title: "Safety & Monitoring",
                        references: [
                            Reference(
                                title: "Vancomycin-associated nephrotoxicity: A systematic review and meta-analysis",
                                authors: "van Hal SJ, Paterson DL, Lodise TP",
                                journal: "PLoS One",
                                year: "2013",
                                volume: "8(2)",
                                pages: "e69394",
                                doi: "10.1371/journal.pone.0069394"
                            ),
                            
                            Reference(
                                title: "Risk factors for vancomycin-associated acute kidney injury",
                                authors: "Lodise TP, Lomaestro B, Graves J, et al.",
                                journal: "Clin Infect Dis",
                                year: "2008",
                                volume: "46(8)",
                                pages: "1204-1212",
                                doi: "10.1086/533662"
                            )
                        ]
                    )
                }
                .padding()
            }
            .navigationTitle("References")
            .navigationBarTitleDisplayMode(.inline)
            .navigationBarItems(
                trailing: Button("Done") {
                    presentationMode.wrappedValue.dismiss()
                }
            )
        }
    }
}

struct ReferenceSection: View {
    let title: String
    let references: [Reference]
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title)
                .font(.headline)
                .fontWeight(.semibold)
            
            VStack(alignment: .leading, spacing: 16) {
                ForEach(references.indices, id: \.self) { index in
                    ReferenceRow(reference: references[index], number: index + 1)
                }
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }
}

struct ReferenceRow: View {
    let reference: Reference
    let number: Int
    
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("\(number). \(reference.title)")
                .font(.subheadline)
                .fontWeight(.medium)
                .fixedSize(horizontal: false, vertical: true)
            
            Text(reference.authors)
                .font(.caption)
                .foregroundColor(.secondary)
                .italic()
            
            Text("\(reference.journal). \(reference.year);\(reference.volume):\(reference.pages)")
                .font(.caption)
                .foregroundColor(.secondary)
            
            if let doi = reference.doi {
                Button("DOI: \(doi)") {
                    if let url = URL(string: "https://doi.org/\(doi)") {
                        UIApplication.shared.open(url)
                    }
                }
                .font(.caption)
                .foregroundColor(.vancoBlue)
            }
        }
    }
}

struct Reference {
    let title: String
    let authors: String
    let journal: String
    let year: String
    let volume: String
    let pages: String
    let doi: String?
}

#Preview {
    AboutView()
}

