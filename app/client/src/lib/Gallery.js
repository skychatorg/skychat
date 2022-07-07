

/**
 * 
 * @param {string[]} folderList List of folders to go to the file
 * @param {*} fileName File name
 * @returns 
 */
const getFileNamePath = (folderList, fileName) => {
    return folderList.length === 0 ? fileName : `${folderList.join('/')}/${fileName}`;
};

const isFileTypeAddable = fileType => {
    return fileType === 'video';
};

const getFileExtension = fileName => {
    return fileName.split('.').pop();
};

const getFileIcon = ({ name, type }) => {
    return {
        video: 'video',
        subtitle: 'closed-captioning',
        audio: 'music',
        image: 'image',
        unknown: 'file',
    }[type] || 'file';
};
const getFileColor = ({ name, type }) => {
    return {
        video: 'rgb(var(--color-tertiary))',
        subtitle: 'rgb(var(--color-tertiary-light))',
        audio: 'rgb(var(--color-secondary))',
        image: 'rgb(var(--color-primary))',
    }[type] || 'rgb(var(--color-skygray-lightest))';
};


export const useGallery = () => {
    return {
        getFileNamePath,
        isFileTypeAddable,
        getFileExtension,
        getFileIcon,
        getFileColor,
    };
};
