export const AJYN_EMAIL_STYLES = `
      :root { color-scheme:light dark;supported-color-schemes:light dark; }
      table { border-spacing:0;border-collapse:collapse;mso-table-lspace:0;mso-table-rspace:0; }
      img { border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic; }
      a { color:inherit;text-decoration:none; }
      .ajyn-body-bg { color-scheme:light dark; }
      .ajyn-font-serif { font-family:Georgia,'Times New Roman',Times,serif !important; }
      .ajyn-font-sans { font-family:Arial,Helvetica,sans-serif !important; }
      .ajyn-light-bg { background:#ffffff !important;background-color:#ffffff !important; }
      .ajyn-soft-bg { background:#f7f4f2 !important;background-color:#f7f4f2 !important; }
      .ajyn-footer-mark-bg { background:#f7f4f2 !important;background-color:#f7f4f2 !important;border-radius:8px !important; }
      .ajyn-footer-mark-wrap { width:100% !important;max-width:100% !important; }
      .ajyn-footer-bg { background:#ffffff !important;background-color:#ffffff !important; }
      .ajyn-hero-bg { background:#f2e9e1 !important;background-color:#f2e9e1 !important; }
      .ajyn-black-bg, .ajyn-cta { background:#000000 !important;background-color:#000000 !important;background-image:linear-gradient(#000000,#000000) !important; }
      .ajyn-text-dark, .ajyn-gmail-text { color:#111111 !important;-webkit-text-fill-color:#111111 !important; }
      .ajyn-text-muted { color:#6b625c !important;-webkit-text-fill-color:#6b625c !important; }
      .ajyn-text-brand { color:#c18c5d !important;-webkit-text-fill-color:#c18c5d !important; }
      .ajyn-text-orange, .ajyn-cta { color:#c18c5d !important;-webkit-text-fill-color:#c18c5d !important; }
      .ajyn-preheader-link { color:#c18c5d !important;-webkit-text-fill-color:#c18c5d !important;font-weight:700; }
      .ajyn-logo-mark { width:110px !important;height:48px !important; }
      .ajyn-footer-mark-img { width:110px !important;height:48px !important;margin:0 auto !important; }
      .ajyn-wordmark-light { display:block !important;max-height:none !important;overflow:visible !important; }
      .ajyn-wordmark-dark { display:none !important;max-height:0 !important;overflow:hidden !important; }
      .ajyn-header-row tr { display:table-row !important; }
      .ajyn-logo-cell { width:50% !important;text-align:left !important;vertical-align:middle !important;padding:0 !important; }
      .ajyn-ref-cell { width:50% !important;text-align:right !important;vertical-align:middle !important;border-top:none !important;padding:0 !important;font-size:11px !important;line-height:1.4 !important;letter-spacing:0.04em !important;text-transform:uppercase !important;white-space:nowrap !important; }
      .ajyn-desktop-divider { display:none !important; }
      .ajyn-preheader { display:none !important; }
      .ajyn-body .ajyn-copy p, .ajyn-body .ajyn-copy strong, .ajyn-body .ajyn-copy td { color:inherit !important;-webkit-text-fill-color:inherit !important; }
      @media (prefers-color-scheme: dark) {
        body, .ajyn-body-bg, .ajyn-shell { background:#09070d !important;background-color:#09070d !important;background-image:linear-gradient(#09070d,#09070d) !important; }
        .ajyn-card, .ajyn-container, .ajyn-header-row, .ajyn-logo-cell, .ajyn-ref-cell, .ajyn-hero-wrap, .ajyn-title, .ajyn-body, .ajyn-divider-cell, .ajyn-help, .ajyn-footer, .ajyn-footer-bg { background:#171514 !important;background-color:#171514 !important;background-image:linear-gradient(#171514,#171514) !important; }
        .ajyn-soft-bg, .ajyn-status-card { background:#24201d !important;background-color:#24201d !important;background-image:linear-gradient(#24201d,#24201d) !important; }
        .ajyn-footer-mark-bg { background:#302923 !important;background-color:#302923 !important;background-image:linear-gradient(#302923,#302923) !important; }
        .ajyn-hero-bg, .ajyn-hero-icon { background:#302923 !important;background-color:#302923 !important;background-image:linear-gradient(#302923,#302923) !important; }
        .ajyn-text-dark, .ajyn-gmail-text, .ajyn-gmail-text p, .ajyn-gmail-text strong, .ajyn-gmail-text span, .ajyn-gmail-text div,
        .ajyn-copy, .ajyn-copy p, .ajyn-copy strong, .ajyn-copy span, .ajyn-copy div, .ajyn-copy td,
        .ajyn-title, .ajyn-title span, .ajyn-status-title, .ajyn-status-text, .ajyn-status-copy,
        .ajyn-help-title, .ajyn-help-subtitle, .ajyn-contact, .ajyn-contact a, .ajyn-ref-cell,
        .ajyn-body td, .ajyn-body p, .ajyn-body strong, .ajyn-body span, .ajyn-body div {
          color:#ffffff !important;-webkit-text-fill-color:#ffffff !important;
        }
        .ajyn-text-muted, .ajyn-footer-copy, .ajyn-footer-legal, .ajyn-preheader-left { color:#d4ccc4 !important;-webkit-text-fill-color:#d4ccc4 !important; }
        .ajyn-text-brand, .ajyn-text-brand span, span.ajyn-text-brand { color:#c18c5d !important;-webkit-text-fill-color:#c18c5d !important; }
        .ajyn-preheader-link { color:#c18c5d !important;-webkit-text-fill-color:#c18c5d !important; }
        .ajyn-cta { background:#000000 !important;background-color:#000000 !important;background-image:linear-gradient(#000000,#000000) !important;color:#c18c5d !important;-webkit-text-fill-color:#c18c5d !important; }
        .ajyn-status-check { border-color:#c18c5d !important;color:#c18c5d !important;-webkit-text-fill-color:#c18c5d !important; }
        .ajyn-wordmark-light { display:none !important;max-height:0 !important;overflow:hidden !important; }
        .ajyn-wordmark-dark { display:block !important;max-height:none !important;overflow:visible !important; }
      }
      [data-ogsc] .ajyn-text-dark, [data-ogsc] .ajyn-gmail-text, [data-ogsc] .ajyn-copy, [data-ogsc] .ajyn-title,
      [data-ogsc] .ajyn-status-title, [data-ogsc] .ajyn-status-text, [data-ogsc] .ajyn-help-title, [data-ogsc] .ajyn-help-subtitle,
      [data-ogsc] .ajyn-contact, [data-ogsc] .ajyn-contact a, [data-ogsc] .ajyn-ref-cell,
      [data-ogsb] .ajyn-text-dark, [data-ogsb] .ajyn-gmail-text, [data-ogsb] .ajyn-copy, [data-ogsb] .ajyn-title {
        color:#ffffff !important;-webkit-text-fill-color:#ffffff !important;
      }
      @media only screen and (max-width: 600px) {
        .ajyn-shell { padding:0 !important; }
        .ajyn-card { width:100% !important;max-width:100% !important;border-radius:0 !important;border:none !important; }
        .ajyn-container { padding:18px 28px 0 !important; }
        .ajyn-preheader { display:table-row !important; }
        .ajyn-preheader-cell { padding:10px 28px 0 !important; }
        .ajyn-preheader-left { font-size:10px !important;line-height:1.4 !important; }
        .ajyn-preheader-link { font-size:10px !important;line-height:1.4 !important; }
        .ajyn-header-row, .ajyn-header-row tbody, .ajyn-header-row tr, .ajyn-logo-cell, .ajyn-ref-cell { display:block !important;width:100% !important;box-sizing:border-box !important; }
        .ajyn-logo-cell { text-align:center !important;padding:0 0 13px !important; }
        .ajyn-logo-lockup { margin:0 auto !important; }
        .ajyn-logo-mark { width:96px !important;height:42px !important;margin:0 auto !important; }
        .ajyn-ref-cell { border-top:1px solid #ece7e2 !important;text-align:center !important;padding:9px 0 7px !important;font-size:9px !important;line-height:1.25 !important;letter-spacing:0.03em !important;white-space:normal !important; }
        .ajyn-hero-wrap { padding:9px 28px 6px !important; }
        .ajyn-hero-icon { width:52px !important;height:52px !important; }
        .ajyn-package-icon-text { font-size:25px !important;line-height:28px !important;margin:11px auto 0 !important; }
        .ajyn-title { font-size:18px !important;line-height:1.25 !important;padding:0 22px 10px !important;white-space:normal !important;overflow-wrap:break-word !important; }
        .ajyn-copy { font-size:11px !important;line-height:1.5 !important;padding-bottom:7px !important; }
        .ajyn-copy p { margin:0 0 5px !important; }
        .ajyn-body { padding:0 29px 4px !important; }
        .ajyn-status-row { padding-bottom:9px !important; }
        .ajyn-status-card { padding:10px 14px !important;border-radius:6px !important; }
        .ajyn-status-icon-cell { width:50px !important; }
        .ajyn-status-check { width:38px !important;height:38px !important;line-height:36px !important;font-size:20px !important; }
        .ajyn-status-title { font-size:14px !important;padding-bottom:3px !important; }
        .ajyn-status-text { font-size:10px !important;line-height:1.35 !important; }
        .ajyn-closing { padding-bottom:9px !important; }
        .ajyn-cta-cell { padding-bottom:13px !important; }
        .ajyn-cta { width:100% !important;box-sizing:border-box !important;padding:11px 14px !important;border-radius:5px !important;font-size:11px !important;letter-spacing:1.8px !important; }
        .ajyn-divider-cell { padding:0 43px !important; }
        .ajyn-help { padding:12px 28px 12px !important; }
        .ajyn-help-icon { padding-bottom:3px !important; }
        .ajyn-support-icon-text { font-size:20px !important;line-height:20px !important; }
        .ajyn-help-title { font-size:13px !important; }
        .ajyn-help-subtitle { font-size:10px !important;padding-bottom:10px !important; }
        .ajyn-contact { font-size:9px !important;white-space:nowrap !important; }
        .ajyn-contact-divider { width:16px !important; }
        .ajyn-footer { padding:16px 24px 18px !important; }
        .ajyn-footer-mark-wrap { width:100% !important;max-width:100% !important; }
        .ajyn-footer-mark-bg td { padding:14px 24px !important; }
        .ajyn-footer-mark-img, .ajyn-logo-mark { width:88px !important;height:38px !important; }
        .ajyn-footer-copy { font-size:10px !important;padding-top:12px !important;padding-bottom:8px !important; }
        .ajyn-footer-legal { font-size:9px !important; }
      }
      @media only screen and (max-width: 600px) and (prefers-color-scheme: light) {
        body, .ajyn-body-bg, .ajyn-shell { background:#ffffff !important;background-color:#ffffff !important; }
      }
      @media only screen and (max-width: 600px) and (prefers-color-scheme: dark) {
        body, .ajyn-body-bg, .ajyn-shell { background:#09070d !important;background-color:#09070d !important;background-image:linear-gradient(#09070d,#09070d) !important; }
        .ajyn-card, .ajyn-container, .ajyn-preheader-cell, .ajyn-header-row, .ajyn-logo-cell, .ajyn-ref-cell, .ajyn-hero-wrap, .ajyn-title, .ajyn-body, .ajyn-divider-cell, .ajyn-help { background:#171514 !important;background-color:#171514 !important;background-image:linear-gradient(#171514,#171514) !important; }
        .ajyn-soft-bg, .ajyn-status-card { background:#24201d !important;background-color:#24201d !important;background-image:linear-gradient(#24201d,#24201d) !important; }
        .ajyn-footer, .ajyn-footer-bg { background:#171514 !important;background-color:#171514 !important;background-image:linear-gradient(#171514,#171514) !important; }
        .ajyn-footer-mark-bg { background:#302923 !important;background-color:#302923 !important;background-image:linear-gradient(#302923,#302923) !important; }
        .ajyn-hero-bg, .ajyn-hero-icon { background:#302923 !important;background-color:#302923 !important;background-image:linear-gradient(#302923,#302923) !important; }
        .ajyn-ref-cell { border-top-color:#3b332e !important; }
        .ajyn-text-dark, .ajyn-gmail-text, .ajyn-gmail-text p, .ajyn-gmail-text strong, .ajyn-gmail-text span, .ajyn-gmail-text div,
        .ajyn-copy, .ajyn-copy p, .ajyn-copy strong, .ajyn-copy span, .ajyn-copy div, .ajyn-copy td,
        .ajyn-title, .ajyn-title span, .ajyn-status-title, .ajyn-status-text, .ajyn-status-copy,
        .ajyn-help-title, .ajyn-help-subtitle, .ajyn-contact, .ajyn-contact a, .ajyn-ref-cell,
        .ajyn-body td, .ajyn-body p, .ajyn-body strong, .ajyn-body span, .ajyn-body div {
          color:#ffffff !important;-webkit-text-fill-color:#ffffff !important;
        }
        .ajyn-text-muted, .ajyn-footer-copy, .ajyn-footer-legal, .ajyn-preheader-left { color:#d4ccc4 !important;-webkit-text-fill-color:#d4ccc4 !important; }
        .ajyn-text-brand, span.ajyn-text-brand { color:#c18c5d !important;-webkit-text-fill-color:#c18c5d !important; }
        .ajyn-preheader-link { color:#c18c5d !important;-webkit-text-fill-color:#c18c5d !important; }
        .ajyn-wordmark-light { display:none !important;max-height:0 !important;overflow:hidden !important; }
        .ajyn-wordmark-dark { display:block !important;max-height:none !important;overflow:visible !important; }
      }
`;
