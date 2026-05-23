import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ProfileCompletionPrompt from "@/components/ProfileCompletionPrompt";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <ProfileCompletionPrompt />
      <main className="flex-1">{children}</main>
      <Footer />
    </>
  );
}
