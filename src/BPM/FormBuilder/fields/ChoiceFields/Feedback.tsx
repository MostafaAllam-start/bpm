import { useTranslation } from "react-i18next";

export function Feedback({ loading, error }: { loading: boolean; error: string | null }) {
  const { t } = useTranslation("form");
  if (loading) return <p className="ff-hint">{t("designer.choicesApi.loading")}</p>;
  if (error) return <p className="ff-error">{t("designer.choicesApi.error", { error })}</p>;
  return null;
}
