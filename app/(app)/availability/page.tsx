import { auth } from "@clerk/nextjs/server";

async function AvailabilityPage() {
    const { userId } = await auth();

    
  return (
    <div>AvailabilityPage</div>
  )
}

export default AvailabilityPage