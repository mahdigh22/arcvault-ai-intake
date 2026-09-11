"use client";

import { createTheme } from "@mui/material/styles";

// One place for the visual language: soft neutrals, a single accent, restrained corners.
export const theme = createTheme({
  palette: {
    primary: { main: "#4f46e5" },
    background: { default: "#f7f8fc", paper: "#ffffff" },
    text: { primary: "#16181d", secondary: "#6b7280" },
    divider: "#e6e8ef",
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
    h5: { fontWeight: 700, letterSpacing: -0.4 },
    h6: { fontWeight: 650, letterSpacing: -0.2 },
    button: { textTransform: "none", fontWeight: 600 },
  },
  components: {
    MuiPaper: { defaultProps: { elevation: 0 } },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { sizeLarge: { paddingInline: 22, paddingBlock: 10 } },
    },
    MuiTextField: { defaultProps: { size: "small" } },
    MuiChip: { styleOverrides: { root: { fontWeight: 500 } } },
    MuiTab: { styleOverrides: { root: { textTransform: "none", fontWeight: 600, minHeight: 44 } } },
  },
});
