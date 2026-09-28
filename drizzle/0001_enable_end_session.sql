-- 所有受信任应用都可发起 OIDC RP-Initiated Logout；此前登记的客户端一律开启
UPDATE `oauth_client` SET `enable_end_session` = 1;
