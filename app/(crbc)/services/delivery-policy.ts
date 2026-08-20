
export async function createDeliveryPolicy(data: {
  policy: string;
  coverage: string;
  minDays: number;
  maxDays: number;
}) {
const response = await fetch("/api/deliverypolicy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error("Failed to create delivery policy");
  }

  const policy = await response.json();
  return policy;
}


export async function getDeliveryPolicies() {
 const response = await fetch("/api/deliverypolicy");
  if (!response.ok) {
    throw new Error("Failed to fetch delivery policies");
  }
  
  return await response.json();
 
}