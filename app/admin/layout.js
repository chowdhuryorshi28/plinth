import AdminTabs from "../../components/AdminTabs";

export const metadata = {
  title: "Plinth",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }) {
  return (
    <>
      <AdminTabs />
      {children}
    </>
  );
}