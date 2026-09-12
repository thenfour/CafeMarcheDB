import { BlitzLayout } from "@blitzjs/next";
import Head from "next/head";
import React from "react";

const Layout: BlitzLayout<{ title?: string; children?: React.ReactNode }> = ({
  title,
  children,
}) => {
  return (
    <>
      <Head>
        <title>{title || "cmdb"}</title>
      </Head>

      {children}
    </>
  )
}

export default Layout
