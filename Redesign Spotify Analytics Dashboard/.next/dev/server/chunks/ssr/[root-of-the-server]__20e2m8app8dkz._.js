module.exports = [
(()=>{"use strict";return[
"[next]/internal/font/google/inter_fa93af41.js [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$next$5d2f$internal$2f$font$2f$google$2f$inter_fa93af41$2e$module$2e$css__$5b$app$2d$rsc$5d$__$28$css__module$29$__ = __turbopack_context__.i("[next]/internal/font/google/inter_fa93af41.module.css [app-rsc] (css module)");
;
const fontData = {
    className: __TURBOPACK__imported__module__$5b$next$5d2f$internal$2f$font$2f$google$2f$inter_fa93af41$2e$module$2e$css__$5b$app$2d$rsc$5d$__$28$css__module$29$__["default"].className,
    style: {
        fontFamily: "'Inter', 'Inter Fallback'",
        fontStyle: "normal"
    }
};
if (__TURBOPACK__imported__module__$5b$next$5d2f$internal$2f$font$2f$google$2f$inter_fa93af41$2e$module$2e$css__$5b$app$2d$rsc$5d$__$28$css__module$29$__["default"].variable != null) {
    fontData.variable = __TURBOPACK__imported__module__$5b$next$5d2f$internal$2f$font$2f$google$2f$inter_fa93af41$2e$module$2e$css__$5b$app$2d$rsc$5d$__$28$css__module$29$__["default"].variable;
}
const __TURBOPACK__default__export__ = fontData;
}),
"[project]/src/app/(frontend)/layout.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>RootLayout,
    "metadata",
    ()=>metadata
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$2_$40$types$2b$node$40$24$2e$_98e27c2ff484fff4e904f2ba7d67bd1f$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.4.2_@types+node@24._98e27c2ff484fff4e904f2ba7d67bd1f/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-jsx-dev-runtime.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$next$5d2f$internal$2f$font$2f$google$2f$inter_fa93af41$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[next]/internal/font/google/inter_fa93af41.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$2_$40$types$2b$node$40$24$2e$_98e27c2ff484fff4e904f2ba7d67bd1f$2f$node_modules$2f$next$2f$script$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.4.2_@types+node@24._98e27c2ff484fff4e904f2ba7d67bd1f/node_modules/next/script.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$make$2d$custom$2d$code$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/make-custom-code.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$make$2d$site$2d$settings$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/make-site-settings.ts [app-rsc] (ecmascript)");
;
;
;
;
;
;
const defaultTitle = "Spotify Analytics Dashboard";
const title = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$make$2d$site$2d$settings$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["makeSiteSettings"].title ?? defaultTitle;
const description = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$make$2d$site$2d$settings$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["makeSiteSettings"].description ?? "Professional analytics workspace for Spotify clustering and music recommendations";
const favicon = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$make$2d$site$2d$settings$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["makeSiteSettings"].icons?.icon ?? "/favicon.svg";
const socialImage = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$make$2d$site$2d$settings$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["makeSiteSettings"].openGraph?.image;
const googleAnalyticsId = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$make$2d$site$2d$settings$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["sanitizeHtmlAttribute"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$make$2d$site$2d$settings$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["makeSiteSettings"].analytics?.googleAnalyticsId);
const metadata = {
    metadataBase: new URL(("TURBOPACK compile-time value", "http://localhost:3000") || "http://localhost:3000"),
    title,
    description,
    robots: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$make$2d$site$2d$settings$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["makeSiteSettings"].robots?.index === false ? {
        follow: false,
        index: false
    } : undefined,
    icons: favicon ? {
        icon: favicon
    } : undefined,
    openGraph: {
        title,
        description,
        images: socialImage ? [
            socialImage
        ] : undefined
    },
    twitter: socialImage ? {
        card: "summary_large_image",
        images: [
            socialImage
        ]
    } : undefined
};
function RootLayout({ children }) {
    const language = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$make$2d$site$2d$settings$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["sanitizeHtmlAttribute"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$make$2d$site$2d$settings$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["makeSiteSettings"].language) || "en";
    const addBypassLinks = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$make$2d$site$2d$settings$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["makeSiteSettings"].accessibility?.addBypassLinks === true;
    const customScripts = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$make$2d$site$2d$settings$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["makeSiteSettings"].customScripts;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$2_$40$types$2b$node$40$24$2e$_98e27c2ff484fff4e904f2ba7d67bd1f$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("html", {
        className: __TURBOPACK__imported__module__$5b$next$5d2f$internal$2f$font$2f$google$2f$inter_fa93af41$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"].className,
        lang: language,
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$2_$40$types$2b$node$40$24$2e$_98e27c2ff484fff4e904f2ba7d67bd1f$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("head", {
                children: [
                    (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$make$2d$custom$2d$code$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["renderHeadCustomCode"])(customScripts?.headStart, "head-start"),
                    (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$make$2d$custom$2d$code$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["renderHeadCustomCode"])(customScripts?.headEnd, "head-end")
                ]
            }, void 0, true, {
                fileName: "[project]/src/app/(frontend)/layout.tsx",
                lineNumber: 63,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$2_$40$types$2b$node$40$24$2e$_98e27c2ff484fff4e904f2ba7d67bd1f$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("body", {
                className: "min-h-screen bg-[#F6F7FC] text-zinc-950 antialiased",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$2_$40$types$2b$node$40$24$2e$_98e27c2ff484fff4e904f2ba7d67bd1f$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$make$2d$custom$2d$code$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["BodyCustomCode"], {
                        html: customScripts?.bodyStart
                    }, void 0, false, {
                        fileName: "[project]/src/app/(frontend)/layout.tsx",
                        lineNumber: 68,
                        columnNumber: 9
                    }, this),
                    addBypassLinks && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$2_$40$types$2b$node$40$24$2e$_98e27c2ff484fff4e904f2ba7d67bd1f$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                        className: "figma-bypass-link",
                        href: "#root",
                        children: "Skip to content"
                    }, void 0, false, {
                        fileName: "[project]/src/app/(frontend)/layout.tsx",
                        lineNumber: 70,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$2_$40$types$2b$node$40$24$2e$_98e27c2ff484fff4e904f2ba7d67bd1f$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        id: "root",
                        tabIndex: -1,
                        children: children
                    }, void 0, false, {
                        fileName: "[project]/src/app/(frontend)/layout.tsx",
                        lineNumber: 74,
                        columnNumber: 9
                    }, this),
                    googleAnalyticsId && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$2_$40$types$2b$node$40$24$2e$_98e27c2ff484fff4e904f2ba7d67bd1f$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$2_$40$types$2b$node$40$24$2e$_98e27c2ff484fff4e904f2ba7d67bd1f$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Fragment"], {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$2_$40$types$2b$node$40$24$2e$_98e27c2ff484fff4e904f2ba7d67bd1f$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$2_$40$types$2b$node$40$24$2e$_98e27c2ff484fff4e904f2ba7d67bd1f$2f$node_modules$2f$next$2f$script$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                                src: `https://www.googletagmanager.com/gtag/js?id=${googleAnalyticsId}`,
                                strategy: "afterInteractive"
                            }, void 0, false, {
                                fileName: "[project]/src/app/(frontend)/layout.tsx",
                                lineNumber: 79,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$2_$40$types$2b$node$40$24$2e$_98e27c2ff484fff4e904f2ba7d67bd1f$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$2_$40$types$2b$node$40$24$2e$_98e27c2ff484fff4e904f2ba7d67bd1f$2f$node_modules$2f$next$2f$script$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                                id: "figma-google-analytics",
                                strategy: "afterInteractive",
                                children: `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', ${JSON.stringify(googleAnalyticsId)});
`
                            }, void 0, false, {
                                fileName: "[project]/src/app/(frontend)/layout.tsx",
                                lineNumber: 83,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/app/(frontend)/layout.tsx",
                        lineNumber: 78,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$2_$40$types$2b$node$40$24$2e$_98e27c2ff484fff4e904f2ba7d67bd1f$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$make$2d$custom$2d$code$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["BodyCustomCode"], {
                        html: customScripts?.bodyEnd
                    }, void 0, false, {
                        fileName: "[project]/src/app/(frontend)/layout.tsx",
                        lineNumber: 93,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/app/(frontend)/layout.tsx",
                lineNumber: 67,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/app/(frontend)/layout.tsx",
        lineNumber: 62,
        columnNumber: 5
    }, this);
}
}),
"[project]/src/lib/make-custom-code.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "BodyCustomCode",
    ()=>BodyCustomCode,
    "renderHeadCustomCode",
    ()=>renderHeadCustomCode
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$2_$40$types$2b$node$40$24$2e$_98e27c2ff484fff4e904f2ba7d67bd1f$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.4.2_@types+node@24._98e27c2ff484fff4e904f2ba7d67bd1f/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-jsx-dev-runtime.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$2_$40$types$2b$node$40$24$2e$_98e27c2ff484fff4e904f2ba7d67bd1f$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.4.2_@types+node@24._98e27c2ff484fff4e904f2ba7d67bd1f/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$html$2d$react$2d$parser$40$5$2e$2$2e$17_$40$types$2b$react$40$19$2e$3$2e$0_react$40$19$2e$3$2e$1$2f$node_modules$2f$html$2d$react$2d$parser$2f$esm$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/html-react-parser@5.2.17_@types+react@19.3.0_react@19.3.1/node_modules/html-react-parser/esm/index.mjs [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$html$2d$react$2d$parser$40$5$2e$2$2e$17_$40$types$2b$react$40$19$2e$3$2e$0_react$40$19$2e$3$2e$1$2f$node_modules$2f$html$2d$react$2d$parser$2f$lib$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/html-react-parser@5.2.17_@types+react@19.3.0_react@19.3.1/node_modules/html-react-parser/lib/index.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$2_$40$types$2b$node$40$24$2e$_98e27c2ff484fff4e904f2ba7d67bd1f$2f$node_modules$2f$next$2f$script$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.4.2_@types+node@24._98e27c2ff484fff4e904f2ba7d67bd1f/node_modules/next/script.js [app-rsc] (ecmascript)");
;
;
;
;
const supportedHeadElements = new Set([
    "base",
    "link",
    "meta",
    "noscript",
    "style",
    "title"
]);
function renderHeadCustomCode(html, slot) {
    if (!html) return null;
    let scriptIndex = 0;
    const options = {
        replace (domNode) {
            if (domNode instanceof __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$html$2d$react$2d$parser$40$5$2e$2$2e$17_$40$types$2b$react$40$19$2e$3$2e$0_react$40$19$2e$3$2e$1$2f$node_modules$2f$html$2d$react$2d$parser$2f$lib$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Element"] && domNode.name === "script") {
                const props = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$html$2d$react$2d$parser$40$5$2e$2$2e$17_$40$types$2b$react$40$19$2e$3$2e$0_react$40$19$2e$3$2e$1$2f$node_modules$2f$html$2d$react$2d$parser$2f$lib$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["attributesToProps"])(domNode.attribs);
                const id = props.id || `figma-custom-code-${slot}-${scriptIndex}`;
                scriptIndex += 1;
                const contents = domNode.children.map((child)=>child.type === "text" ? child.data : "").join("");
                const scriptContents = contents.trim() ? contents : undefined;
                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$2_$40$types$2b$node$40$24$2e$_98e27c2ff484fff4e904f2ba7d67bd1f$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$2_$40$types$2b$node$40$24$2e$_98e27c2ff484fff4e904f2ba7d67bd1f$2f$node_modules$2f$next$2f$script$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                    ...props,
                    id: id,
                    strategy: "afterInteractive",
                    children: scriptContents
                }, void 0, false, {
                    fileName: "[project]/src/lib/make-custom-code.tsx",
                    lineNumber: 39,
                    columnNumber: 11
                }, this);
            }
            if (domNode.parent && domNode.parent.type !== "root") return;
            if (domNode instanceof __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$html$2d$react$2d$parser$40$5$2e$2$2e$17_$40$types$2b$react$40$19$2e$3$2e$0_react$40$19$2e$3$2e$1$2f$node_modules$2f$html$2d$react$2d$parser$2f$lib$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Element"] && supportedHeadElements.has(domNode.name)) {
                return;
            }
            // Head custom code can contain whitespace, comments, or body-only HTML.
            // Only elements React and HTML support in <head> are rendered here.
            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$2_$40$types$2b$node$40$24$2e$_98e27c2ff484fff4e904f2ba7d67bd1f$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$2_$40$types$2b$node$40$24$2e$_98e27c2ff484fff4e904f2ba7d67bd1f$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"].Fragment, {}, void 0, false, {
                fileName: "[project]/src/lib/make-custom-code.tsx",
                lineNumber: 55,
                columnNumber: 14
            }, this);
        }
    };
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$html$2d$react$2d$parser$40$5$2e$2$2e$17_$40$types$2b$react$40$19$2e$3$2e$0_react$40$19$2e$3$2e$1$2f$node_modules$2f$html$2d$react$2d$parser$2f$esm$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["default"])(html, options);
}
function BodyCustomCode({ html }) {
    if (!html) return null;
    const contents = {
        __html: html
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$2_$40$types$2b$node$40$24$2e$_98e27c2ff484fff4e904f2ba7d67bd1f$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "figma-custom-code-fragment",
        suppressHydrationWarning: true,
        dangerouslySetInnerHTML: contents
    }, void 0, false, {
        fileName: "[project]/src/lib/make-custom-code.tsx",
        lineNumber: 67,
        columnNumber: 5
    }, this);
}
}),
"[project]/src/lib/make-site-settings.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "makeSiteSettings",
    ()=>makeSiteSettings,
    "sanitizeHtmlAttribute",
    ()=>sanitizeHtmlAttribute
]);
var __TURBOPACK__imported__module__$5b$project$5d2f2e$figma$2f$make$2f$site$2e$json$2e5b$json$5d2e$cjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/.figma/make/site.json.[json].cjs [app-rsc] (ecmascript)");
;
const makeSiteSettings = __TURBOPACK__imported__module__$5b$project$5d2f2e$figma$2f$make$2f$site$2e$json$2e5b$json$5d2e$cjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"];
function sanitizeHtmlAttribute(value) {
    return value?.replace(/[^a-zA-Z0-9_-]/g, '') || '';
}
}),
]})(),
"[next]/internal/font/google/inter_fa93af41.module.css [app-rsc] (css module)", ((__turbopack_context__) => {

__turbopack_context__.v({
  "className": "inter_fa93af41-module__0D_jrq__className",
});
}),
"[project]/.figma/make/site.json.[json].cjs [app-rsc] (ecmascript)", ((__turbopack_context__, module, exports) => {

module.exports = {};
}),
"[project]/src/app/(frontend)/layout.tsx [app-rsc] (ecmascript, Next.js Server Component)", (function(__turbopack_context__){

__turbopack_context__.n(__turbopack_context__.i("[project]/src/app/(frontend)/layout.tsx [app-rsc] (ecmascript)"));
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__20e2m8app8dkz._.js.map