import { useClientStore } from '@/stores/client';
import { ref } from 'vue';

/**
 * Rename and delete for the channel lists of the admin panel, both driven by a `/<command> rename|delete <id>` command
 */
export function useManagedList(command) {
    const client = useClientStore();
    const manage = (args) => client.sendMessage(`/${command} ${args}`);

    function rename(item, event) {
        const name = event.target.value.trim();
        if (name && name !== item.name) {
            manage(`rename ${item.id} ${name}`);
        } else {
            event.target.value = item.name;
        }
    }

    // Deleting asks once more on the same button: it throws everyone out of the channel
    const confirmingDelete = ref(null);
    function remove(item) {
        if (confirmingDelete.value !== item.id) {
            confirmingDelete.value = item.id;
            return;
        }
        confirmingDelete.value = null;
        manage(`delete ${item.id}`);
    }

    return { manage, rename, confirmingDelete, remove };
}
