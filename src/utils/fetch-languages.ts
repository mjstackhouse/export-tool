import createDeliveryClientContainer from './delivery-client';
import { DeliveryError } from '@kontent-ai/delivery-sdk';

export default async function fetchTypes(environmentId: string, apiKey: string) {
  let deliveryClient = await createDeliveryClientContainer(environmentId, apiKey);

  try {
    const response = await deliveryClient.languages()
      .toPromise();

    return response.data;
  } 
  catch (error) {
    if (error instanceof DeliveryError) console.log(error.message, error.errorCode);
    else console.log(error);
    return 'error';
  }
}