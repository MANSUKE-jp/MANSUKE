import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';

export async function uploadProfilePicture(uid, blob) {
    const ext = blob.type?.split('/')[1] || 'jpeg';
    const filePath = `avatars/${uid}_${Date.now()}.${ext}`;
    const fileRef = ref(storage, filePath);
    
    await uploadBytes(fileRef, blob);
    const url = await getDownloadURL(fileRef);
    return url;
}
