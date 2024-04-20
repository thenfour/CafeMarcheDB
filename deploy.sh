#!/bin/bash

# Check if command line argument is provided
if [ "$#" -ne 1 ]; then
    echo "Usage: $0 username@server:/path"
    exit 1
fi

# Extract destination information from command line argument
DESTINATION="$1"

# Determine the directory where the script resides
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FILES_LIST="$PROJECT_DIR/files_to_deploy.txt"

ARCHIVE_NAME="cmdb_v1_$(date +%Y-%m-%d_%H-%M-%S).tar.gz"

echo "PROJECT_DIR: $PROJECT_DIR"
echo "DESTINATION: $DESTINATION"
echo "FILES_LIST: $FILES_LIST"
echo "ARCHIVE_NAME: $ARCHIVE_NAME"

# Change to the script directory
cd "$PROJECT_DIR"

# Check if the files list exists
if [ ! -f "$FILES_LIST" ]; then
    echo "File list $FILES_LIST does not exist."
    exit 1
fi

read -p "Press enter to create the archive"
echo "Creating $ARCHIVE_NAME ..."
# Create a tar.gz archive of the relevant directories and files
tar -czf $ARCHIVE_NAME -T $FILES_LIST
if [ $? -ne 0 ]; then
    echo "Failed to create archive. Check the files list and permissions."
    exit 1
fi

# Display the archive information
echo "Archive created successfully:"
ls -lh $ARCHIVE_NAME

read -p "Press enter to upload or CTRL+C to cancel."

# Upload the archive to the production server
scp $ARCHIVE_NAME $DESTINATION
if [ $? -ne 0 ]; then
    echo "Failed to upload the archive. Check your network connection and destination details."
    exit 1
fi


echo "Deployment package $ARCHIVE_NAME has been uploaded successfully."

read -p "Do you want to delete the local archive file? (y/n): " choice
if [[ $choice == [Yy]* ]]; then
    rm $ARCHIVE_NAME
    echo "Archive deleted locally."
else
    echo "Archive kept locally."
fi
