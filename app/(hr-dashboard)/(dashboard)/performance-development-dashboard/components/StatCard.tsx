import Card from "./Card";

type StatCardProps = {
  label: string;
  value: string | number;
};

export default function StatCard({ label, value }: StatCardProps) {
  return (
    <Card className="min-w-[140px]">
      <p className="mb-1 font-bricolage text-3xl font-bold">{value}</p>
      <p className="text-sm text-muted">{label}</p>
    </Card>
  );
}
