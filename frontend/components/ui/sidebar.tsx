"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import React, { createContext, useContext, useState } from "react";
import { motion } from "framer-motion";
import { Menu, X } from "lucide-react";

interface Links {
  label: string;
  href: string;
  icon: React.JSX.Element | React.ReactNode;
}

interface SidebarContextProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  animate: boolean;
}

const SidebarContext = createContext<SidebarContextProps | undefined>(undefined);

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
};

export const SidebarProvider = ({
  children,
  open: openProp,
  setOpen: setOpenProp,
  animate = true,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}) => {
  const [openState, setOpenState] = useState(false);
  const open = openProp !== undefined ? openProp : openState;
  const setOpen = setOpenProp !== undefined ? setOpenProp : setOpenState;

  return (
    <SidebarContext.Provider value={{ open, setOpen, animate }}>{children}</SidebarContext.Provider>
  );
};

export const Sidebar = ({
  children,
  open,
  setOpen,
  animate,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}) => {
  return (
    <SidebarProvider open={open} setOpen={setOpen} animate={animate}>
      {children}
    </SidebarProvider>
  );
};

export const SidebarBody = (
  props: React.ComponentProps<typeof motion.div> & { hideHeader?: boolean },
) => {
  const { hideHeader, ...rest } = props;
  return (
    <>
      <DesktopSidebar {...rest} />
      <MobileSidebar {...(rest as React.ComponentProps<"div">)} hideHeader={hideHeader} />
    </>
  );
};

export const DesktopSidebar = ({
  className,
  children,
  ...props
}: React.ComponentProps<typeof motion.div>) => {
  const { open, setOpen, animate } = useSidebar();
  return (
    <motion.div
      className={cn(
        "hidden min-h-screen h-screen flex-shrink-0 self-stretch px-4 py-4 md:flex md:flex-col md:sticky md:top-0 bg-neutral-100 dark:bg-neutral-900 border-r border-white/10",
        className,
      )}
      animate={{
        width: animate ? (open ? "280px" : "68px") : "280px",
      }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      {...props}
    >
      {children}
    </motion.div>
  );
};

export const MobileSidebar = ({
  className,
  children,
  hideHeader,
  ...props
}: React.ComponentProps<"div"> & { hideHeader?: boolean }) => {
  const { open, setOpen } = useSidebar();
  return (
    <>
      {!hideHeader && (
        <div
          className={cn(
            "h-12 px-4 flex flex-row md:hidden items-center justify-between bg-neutral-100 dark:bg-neutral-900 w-full border-b border-white/10",
          )}
          {...props}
        >
          <div className="flex justify-start z-20 w-full">
            <Menu
              className="text-neutral-800 dark:text-neutral-200 cursor-pointer"
              onClick={() => setOpen(!open)}
            />
          </div>
        </div>
      )}
      <div
        className={cn(
          "fixed inset-0 z-[100] md:hidden transition-opacity duration-150",
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <button
          type="button"
          aria-label="Close sidebar"
          className="absolute inset-0 bg-black/30"
          onClick={() => setOpen(false)}
        />
        <aside
          className={cn(
            "relative h-full w-[82vw] max-w-[280px] bg-white dark:bg-neutral-900 p-6 flex flex-col justify-between border-r border-black/10 dark:border-white/10 shadow-2xl",
            "transition-transform duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform",
            open ? "translate-x-0" : "-translate-x-full",
            className,
          )}
        >
          <div
            className="absolute right-4 top-4 z-50 text-neutral-800 dark:text-neutral-200 cursor-pointer"
            onClick={() => setOpen(false)}
          >
            <X />
          </div>
          {children}
        </aside>
      </div>
    </>
  );
};

export const SidebarLink = ({
  link,
  className,
  onClick,
  ...props
}: Omit<React.ComponentProps<typeof Link>, "href"> & {
  link: Links;
  className?: string;
}) => {
  const { open, animate, setOpen } = useSidebar();
  return (
    <Link
      href={link.href}
      className={cn("flex items-center justify-start gap-2 group/sidebar py-2", className)}
      onClick={(event) => {
        onClick?.(event);
        if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
          setOpen(false);
        }
      }}
      {...props}
    >
      {link.icon}
      <motion.span
        animate={{
          display: animate ? (open ? "inline-block" : "none") : "inline-block",
          opacity: animate ? (open ? 1 : 0) : 1,
        }}
        className="text-neutral-700 dark:text-neutral-200 text-sm group-hover/sidebar:translate-x-1 transition duration-150 whitespace-pre inline-block !p-0 !m-0"
      >
        {link.label}
      </motion.span>
    </Link>
  );
};
