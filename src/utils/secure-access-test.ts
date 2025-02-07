import createDeliveryClientContainer from './delivery-client';
import { DeliveryError } from '@kontent-ai/delivery-sdk';

export default async function secureAccessTest(environmentId: string, apiKey: string) {
  let deliveryClient = await createDeliveryClientContainer(environmentId, apiKey);

  try {
    const query = deliveryClient.items()
      .limitParameter(1)
      .depthParameter(0)
      .equalsFilter('system.workflow_step', 'published')
      .queryConfig({ usePreviewMode: false, useSecuredMode: true });    

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