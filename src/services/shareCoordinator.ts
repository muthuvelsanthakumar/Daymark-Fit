import * as Sharing from 'expo-sharing';

// Serialize every native share-sheet request app-wide. A second PDF export waits
// until the first share sheet is dismissed instead of rejecting with Expo's
// "Another share request is being processed now" error.
let shareQueue: Promise<unknown> = Promise.resolve();

export function sharePdf(uri: string, dialogTitle: string): Promise<void> {
  const request = shareQueue.then(async () => {
    if (!(await Sharing.isAvailableAsync())) {
      throw new Error('Sharing is not available on this device. The PDF was generated locally.');
    }
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle });
  });
  shareQueue = request.catch(() => undefined);
  return request;
}
