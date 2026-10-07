# Publish your operator

Use the [main setup guide](../README.md#set-up-your-operator). Its `renew --watch` command creates your listing on the first run and maintains it afterward. You do not need a separate registration step.

Each operator has its own account under the existing SPL Record program. There is no shared directory account to create or central router to contact. `protect` derives that individual listing address and adds it to the operator's Kora deny list. Restart Kora before publishing.

For changes or retirement, see [operating your listing](RENEWAL.md). For direct RPC discovery and signature verification, see the [record format](SPL-RECORD-LISTINGS.md).
