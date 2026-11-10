package cn.qlucampus.personal;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.util.Arrays;
import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** The encoded format: one unsigned IV-length byte, IV, then AES-GCM ciphertext/tag.
 *  No key creation, file deletion, logging or forgiving text conversion occurs here. */
public final class VaultCodec {
    public static final int MAX_BYTES = 1024 * 1024;
    private VaultCodec() {}

    public static String decrypt(byte[] envelope, SecretKey existingKey)
            throws IOException, GeneralSecurityException {
        if (existingKey == null) throw new GeneralSecurityException("Existing vault key is unavailable");
        if (envelope == null || envelope.length < 1 || envelope.length > MAX_BYTES)
            throw new IOException("Invalid vault length");
        int ivLength = envelope[0] & 255;
        if (ivLength < 12 || ivLength > 32 || envelope.length < ivLength + 17)
            throw new IOException("Invalid vault envelope");
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, existingKey,
                new GCMParameterSpec(128, Arrays.copyOfRange(envelope, 1, ivLength + 1)));
        byte[] plain = cipher.doFinal(Arrays.copyOfRange(envelope, ivLength + 1, envelope.length));
        try {
            return StandardCharsets.UTF_8.newDecoder()
                    .onMalformedInput(CodingErrorAction.REPORT)
                    .onUnmappableCharacter(CodingErrorAction.REPORT)
                    .decode(ByteBuffer.wrap(plain)).toString();
        } finally {
            Arrays.fill(plain, (byte) 0);
        }
    }

    public static byte[] encrypt(String json, SecretKey key)
            throws IOException, GeneralSecurityException {
        if (json == null || key == null) throw new GeneralSecurityException("Vault value/key is unavailable");
        byte[] plain = json.getBytes(StandardCharsets.UTF_8);
        try {
            if (plain.length > MAX_BYTES - 49) throw new IOException("Vault is too large");
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key);
            byte[] iv = cipher.getIV();
            if (iv.length < 12 || iv.length > 32) throw new GeneralSecurityException("Unsupported IV length");
            byte[] sealed = cipher.doFinal(plain);
            ByteArrayOutputStream out = new ByteArrayOutputStream(1 + iv.length + sealed.length);
            out.write(iv.length);
            out.write(iv, 0, iv.length);
            out.write(sealed, 0, sealed.length);
            return out.toByteArray();
        } finally {
            Arrays.fill(plain, (byte) 0);
        }
    }
}
