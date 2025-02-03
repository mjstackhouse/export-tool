// import deliveryClient from './delivery-client';
import createDeliveryClientContainer from './delivery-client';

export default async function fetchItems(environmentId: string, apiKey: string, types: Array<string>, workflowStep: string) {
  let deliveryClient = await createDeliveryClientContainer(environmentId, apiKey);

  if (workflowStep === 'published') {
    const response = await deliveryClient.items()
    .orderByAscending('system.type')
    .types(types)
    .equalsFilter('system.workflow_step', 'published')
    .toPromise();

    return response.data;
  }
  else if (workflowStep === 'draft') {
    const response = await deliveryClient.items()
    .orderByAscending('system.type')
    .types(types)
    .equalsFilter('system.workflow_step', 'draft')
    .toPromise();

    return response.data;
  }
  else {
    const response = await deliveryClient.items()
    .orderByAscending('system.type')
    .types(types)
    .toPromise();

    return response.data;
  }
  

  // return response.data;
}