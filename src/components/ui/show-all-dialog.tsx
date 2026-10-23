"use client";

import { type ReactNode, useState } from "react";
import { buttonClass } from "./button";
import { SheetDialog } from "./sheet-dialog";

/** A "show all" button whose full list opens in a popup (a full-screen sheet on a phone), never a new page. */
export function ShowAllDialog({
  label,
  title,
  children,
}: {
  label: string;
  title: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={buttonClass({ variant: "secondary" }, "mt-8")}
      >
        {label}
      </button>
      <SheetDialog open={open} onClose={() => setOpen(false)} title={title}>
        <div className="p-6">{children}</div>
      </SheetDialog>
    </>
  );
}
