import { Outlet } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { SidebarProvider } from "./ui/sidebar";
import Navbar from "./Navbar";

const MainLayout = () => {
  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="flex h-dvh w-full min-w-0 flex-col">
        <Navbar />
        <Outlet />
      </main>
    </SidebarProvider>
  );
};

export default MainLayout;