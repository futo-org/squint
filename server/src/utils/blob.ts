import { Constants } from 'src/constants.js';

export const getBlobKey = (sha256: string) => {
  const { Folder, FanoutLength, Extension } = Constants.Blobs;

  return `${Folder}/${sha256.slice(0, FanoutLength)}/${sha256}${Extension}`;
};
