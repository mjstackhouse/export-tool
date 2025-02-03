import { createDeliveryClient, DeliveryClient } from '@kontent-ai/delivery-sdk';

export default function createDeliveryClientContainer(environmentId: string, apiKey: string) {
  let deliveryClient: DeliveryClient;

  if (apiKey !== '') {
    deliveryClient = createDeliveryClient({
      environmentId: environmentId,
      defaultLanguage: 'en-US',
      defaultQueryConfig: {
        usePreviewMode: true
      },
      previewApiKey: apiKey,
      globalHeaders: (queryConfig) => {
        return [
          {
            header: 'X-KC-Wait-For-Loading-New-Content',
            value: 'true'
          }
        ]
      }
    });
  }
  else {
    deliveryClient = createDeliveryClient({
      environmentId: environmentId,
      defaultLanguage: 'en-US',
      globalHeaders: (queryConfig) => {
        return [
          {
            header: 'X-KC-Wait-For-Loading-New-Content',
            value: 'true'
          }
        ]
      }
    });
  }

  return deliveryClient;
}