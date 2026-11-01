import { useToast } from 'vue-toastification';

/**
 * Copy text and say whether it worked: the clipboard API is missing outside https and can be denied
 */
export async function copyText(text) {
    const toast = useToast();
    try {
        await navigator.clipboard.writeText(text);
        toast.success('Copied');
    } catch {
        toast.error('Could not copy to the clipboard');
    }
}
