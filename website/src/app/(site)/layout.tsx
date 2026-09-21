import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ProfileCompletionPrompt from "@/components/ProfileCompletionPrompt";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="vz-site-frame flex min-h-screen flex-col">
      <Header />
      <ProfileCompletionPrompt />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
