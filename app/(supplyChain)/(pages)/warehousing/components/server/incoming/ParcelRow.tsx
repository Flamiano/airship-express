import { maskName } from "@/app/(supplyChain)/components/global/dataMasking";
import DeleteButton from "../../client/incoming/DeleteButton";

interface Parcel {
    id: number;
    barcode: string;
    tracking_number: string;
    sender_name: string | null;
    customer_name: string | null;
    customer_number: string | null;
    destination: string | null;
    region: string | null;
    courier: string | null;
    scanned_by: string | null;
    scanned_at: string;
    status: 'pending' | 'verified' | 'rejected';
}

interface ParcelRowProps {
    parcel: Parcel;
    index: number;
    onDelete?: () => void;
    isSelected?: boolean;
    onSelect?: (id: number) => void;
}

export function ParcelRow({
    parcel,
    index,
    onDelete,
    isSelected = false,
    onSelect
}: ParcelRowProps) {
    const statusColors: Record<string, string> = {
        'pending': 'bg-yellow-50 text-yellow-700 border-yellow-200/60',
        'verified': 'bg-green-50 text-green-700 border-green-200/60',
        'rejected': 'bg-red-50 text-red-700 border-red-200/60',
    };

    const statusColor = statusColors[parcel.status] || statusColors['pending'];

    return (
        <tr
            className={`even:bg-gray-100 transition-colors duration-150 ${isSelected
                ? "bg-pink-50/40 hover:bg-pink-50/70"
                : "hover:bg-slate-50/80"
                }`}
        >
            <td className="py-3 px-4 w-12 text-center">
                <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onSelect?.(parcel.id)}
                    className="w-4 h-4 rounded border-slate-300 text-pink-600 focus:ring-pink-500 focus:ring-2 cursor-pointer transition-all"
                />
            </td>

            <td className="py-3 px-3 w-12 font-semibold text-slate-400 text-xs">
                {index}
            </td>

            <td className="py-3 px-4 font-mono font-semibold text-slate-900 whitespace-nowrap">
                <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200/60">
                    {parcel.barcode}
                </span>
            </td>

            <td className="py-3 px-4 font-mono text-slate-500 text-xs whitespace-nowrap">
                {parcel.tracking_number || "—"}
            </td>

            <td className="py-3 px-4 font-semibold text-slate-800 max-w-40 truncate">
                {maskName(parcel.sender_name)}
            </td>

            <td className="py-3 px-4 font-semibold text-slate-800 max-w-40 truncate">
                {maskName(parcel.customer_name)}
            </td>

            <td className="py-3 px-4 font-semibold text-slate-800 max-w-40 truncate">
                {parcel.customer_number || <span className="text-slate-400">N/A</span>}
            </td>

            <td className="py-3 px-4 text-slate-600 max-w-45 truncate">
                {parcel.destination || <span className="text-slate-400">N/A</span>}
            </td>

            <td className="py-3 px-4 text-slate-600 max-w-45 truncate">
                {parcel.region || <span className="text-slate-400">N/A</span>}
            </td>

            <td className="py-3 px-4 font-medium text-slate-700 whitespace-nowrap">
                {parcel.courier ? (
                    <span className="inline-flex items-center gap-1.5">
                        <i className="fas fa-truck text-[10px] text-slate-400"></i>
                        {parcel.courier}
                    </span>
                ) : (
                    <span className="text-slate-400">Unassigned</span>
                )}
            </td>

            <td className="py-3 px-4 whitespace-nowrap">
                <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${statusColor || "bg-slate-100 text-slate-600 border-slate-200"
                        }`}
                >
                    {parcel.status}
                </span>
            </td>

            <td className="py-3 px-4 text-right whitespace-nowrap">
                <DeleteButton parcelId={String(parcel.id)} onDelete={onDelete} />
            </td>
        </tr>
    );
}