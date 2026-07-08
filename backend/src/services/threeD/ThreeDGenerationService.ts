export interface IThreeDGenerationService {
  generate(productId: string): Promise<any>;
  delete(productId: string): Promise<any>;
  getStatus(productId: string): Promise<any>;
  download(productId: string): Promise<any>;
}

export class ThreeDGenerationService implements IThreeDGenerationService {
  async generate(productId: string): Promise<any> {
    throw new Error('Not Implemented');
  }

  async delete(productId: string): Promise<any> {
    throw new Error('Not Implemented');
  }

  async getStatus(productId: string): Promise<any> {
    throw new Error('Not Implemented');
  }

  async download(productId: string): Promise<any> {
    throw new Error('Not Implemented');
  }
}
