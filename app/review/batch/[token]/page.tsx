import { ReviewBatchClient } from "./review-batch-client"

export default async function ReviewBatchPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  return <ReviewBatchClient token={token} />
}
