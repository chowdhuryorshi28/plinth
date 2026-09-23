export default function Footer() {
  return (
    <footer className="border-t border-line mt-16">
      <div className="max-w-7xl mx-auto px-5 md:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <span className="text-[12.5px] text-inksoft">
          © {new Date().getFullYear()} Plinth. Designed &amp; built by <strong className="text-ink">p._.orshi</strong>.
        </span>
        <div className="flex gap-5 text-[13px] text-inksoft">
          <a href="/" className="hover:text-ink">Browse</a>
          <a href="/post" className="hover:text-ink">Post a project</a>
        </div>
      </div>
    </footer>
  );
}