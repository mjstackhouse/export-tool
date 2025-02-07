import createDeliveryClientContainer from './delivery-client';
import { DeliveryError } from '@kontent-ai/delivery-sdk';

export default async function previewTest(environmentId: string, apiKey: string) {
  let deliveryClient = await createDeliveryClientContainer(environmentId, apiKey);

  try {
    const query = deliveryClient.items()
      .limitParameter(1)
      .depthParameter(0)
      .queryConfig({ usePreviewMode: true, useSecuredMode: false });

    const response = await query
      .toPromise();

    return response.data;
  } 
  catch (error) {
    if (error instanceof DeliveryError) console.log(error.message, error.errorCode);
    else console.log(error);
    
    return (error as DeliveryError).message;
  }
}