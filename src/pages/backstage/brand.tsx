import { BlitzPage } from "@blitzjs/next";
import { useMutation, invoke } from "@blitzjs/rpc";
import { Box, Button, Grid, TextField, Typography, MenuItem } from "@mui/material";
import React from "react";
import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
import { Permission } from "shared/permissions";
import getSetting from "@/src/auth/queries/getSetting";
import updateSetting from "@/src/auth/mutations/updateSetting";
import clearBrandCache from "@/src/auth/mutations/clearBrandCache";
import { Setting } from "@/shared/settingKeys";
import { SnackbarContext } from "@/src/core/components/SnackbarContext";

const fields = [
  { key: Setting.Dashboard_SiteTitle, label: "Site Title" },
  { key: Setting.Dashboard_SiteTitlePrefix, label: "Title Prefix" },
  { key: Setting.Dashboard_SiteFaviconUrl, label: "Favicon URL" },
  { key: Setting.Dashboard_Theme_PrimaryMain, label: "Primary Main" },
  { key: Setting.Dashboard_Theme_SecondaryMain, label: "Secondary Main" },
  { key: Setting.Dashboard_Theme_BackgroundDefault, label: "Background Default" },
  { key: Setting.Dashboard_Theme_BackgroundPaper, label: "Background Paper" },
  { key: Setting.Dashboard_Theme_TextPrimary, label: "Text Primary (optional)" },
];

const BrandForm = () => {
  const { showMessage } = React.useContext(SnackbarContext);
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [updateSettingMutation] = useMutation(updateSetting);
  const [clearBrandCacheMutation] = useMutation(clearBrandCache);

  // Load current values
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      const entries = await Promise.all(
        fields.map(async f => {
          try {
            const val = await invoke(getSetting, { name: f.key });
            return [String(f.key), String(val ?? "")];
          } catch { return [String(f.key), ""]; }
        })
      );
      if (mounted) setValues(Object.fromEntries(entries));
    })();
    return () => { mounted = false; };
  }, []);

  const onChange = (k: string, v: string) => setValues(s => ({ ...s, [k]: v }));

  const onSave = async () => {
    for (const f of fields) {
      await updateSettingMutation({ name: f.key, value: (values[f.key] ?? "") });
    }
    await clearBrandCacheMutation({});
    showMessage({ severity: "success", children: "Brand settings saved. Cache cleared. Refresh to see changes." });
  };

  return (
    <Box display="flex" flexDirection="column" gap={2}>
      <Typography variant="h6">Brand Settings</Typography>
      <Grid container spacing={2}>
        {fields.map(f => (
          <Grid item xs={12} md={6} key={f.key}>
            {/* Use native color picker for color-ish fields */}
            {(/Primary|Secondary|Background|TextPrimary/i.test(f.key)) ? (
              <TextField
                fullWidth
                type="color"
                label={f.label}
                value={(values[f.key] ?? "").toString() || "#000000"}
                onChange={e => onChange(f.key, e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            ) : (
              <TextField fullWidth label={f.label} value={values[f.key] ?? ""} onChange={e => onChange(f.key, e.target.value)} />
            )}
          </Grid>
        ))}
      </Grid>
      <Box>
        <Button variant="contained" onClick={onSave}>Save</Button>
      </Box>
    </Box>
  );
};

const BrandPage: BlitzPage = () => {
  return (
    <DashboardLayout title="Brand" basePermission={Permission.sysadmin}>
      <BrandForm />
    </DashboardLayout>
  );
};

export default BrandPage;
