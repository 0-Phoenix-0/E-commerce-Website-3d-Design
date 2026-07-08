import { api } from '../api';
import type { ThreeDModel } from '@/types';

export interface ThreeDResponse {
  status: 'none' | 'processing' | 'ready' | 'failed';
  modelUrl: string | null;
  previewImage: string | null;
  metadata: Omit<ThreeDModel, 'status' | 'modelUrl' | 'previewImage'>;
}

export const threeDApi = {
  /**
   * Fetches metadata for a product's 3D model.
   */
  getMetadata: (productId: string) => 
    api.get<ThreeDResponse>(`/products/${productId}/3d`),

  /**
   * Triggers the 3D model generation process.
   */
  generate: (productId: string) => 
    api.post<{ message: string }>(`/products/${productId}/3d/generate`, {}),

  /**
   * Updates 3D model metadata manually.
   */
  updateMetadata: (productId: string, metadata: Partial<ThreeDModel>) => 
    api.put<ThreeDModel>(`/products/${productId}/3d`, metadata),

  /**
   * Resets and deletes the stored 3D model metadata.
   */
  deleteMetadata: (productId: string) => 
    api.delete<{ message: string; data: ThreeDModel }>(`/products/${productId}/3d`),
};
