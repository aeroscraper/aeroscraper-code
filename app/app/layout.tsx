// import Providers from "@/contexts/Providers";
import AppLayout from "@/layouts/AppLayout";

const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    // <Providers>
    <AppLayout>{children}</AppLayout>
    // </Providers>
  );
};

export default Layout;
