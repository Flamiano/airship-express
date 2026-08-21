import AssetCostTable from "./AssetCostTable";
import CostOptimizationInsights from "./CostOptimizationInsights";

type CostEntry = {
  id: string;
  vehicleId?: string | null;
  tripId?: string | null;
  category: string;
  amount: number | null;
  entryDate?: string | null;
  remarks?: string | null;
};

type Insight = {
  icon: string;
  iconColor: string;
  label: string;
  value: string;
  valueColor: string;
  valueSuffix?: string;
  borderLeft?: boolean;
};

export default function DataTableRow({ costEntries, insights }: { costEntries: CostEntry[]; insights: Insight[] }) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(280px,340px)_minmax(0,1fr)] gap-gutter items-start">
      <div className="self-start">
        <CostOptimizationInsights insights={insights} />
      </div>
      <div className="self-start">
        <AssetCostTable entries={costEntries} />
      </div>
    </div>
  );
}
