import { getHashedColor } from '@/shared/utils';
import MarkdownIt from 'markdown-it';
import { getAbsoluteUrl } from '../../db3/clientAPILL';
import { generateQrApiUrl, QrHelpers, QrContentConfig } from '../../db3/shared/qrApi';

export function ReactInlineMarkdownPlugin(md: MarkdownIt) {
    const originalTextRule = md.renderer.rules.text ||
        ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));

    md.renderer.rules.text = (tokens, idx, options, env, self) => {
        let output = originalTextRule(tokens, idx, options, env, self);

        // Then apply the `{{ ... }}` replacements
        output = output.replace(/\{\{(\w+)(:.*?)?\}\}/g, (match, componentName, propsString = '') => {
            if (propsString && propsString.length > 1) {
                propsString = propsString.slice(1).replaceAll("\\}", "}");
            }
            if (componentName === "abc") {
                // Generate ABC notation image for inline display
                const abcContent = propsString.trim();
                if (!abcContent) {
                    return match; // Return original if empty
                }

                // Create minimal ABC notation with required headers
                const fullAbcNotation = `X:1\nK:C\n${abcContent}`;
                const encodedNotation = encodeURIComponent(fullAbcNotation);

                // Create img element for inline ABC notation
                const img = document.createElement('img');
                img.src = getAbsoluteUrl(`/api/abc/render?notation=${encodedNotation}`);
                img.className = 'abc-notation-inline';
                img.alt = `ABC notation: ${abcContent}`;

                return img.outerHTML;
            }
            if (componentName === "qr") {
                // Generate QR code image for inline display
                const qrContent = propsString.trim();
                if (!qrContent) {
                    return match; // Return original if empty
                }

                try {
                    // Parse QR content - format: type:content or just content (defaults to text)
                    let contentConfig: QrContentConfig;

                    const colonIndex = qrContent.indexOf(':');
                    if (colonIndex > 0 && colonIndex < 20) { // reasonable type length limit
                        const possibleType = qrContent.substring(0, colonIndex).toLowerCase();
                        const qrData = qrContent.substring(colonIndex + 1);

                        switch (possibleType) {
                            case 'url':
                                contentConfig = QrHelpers.url(qrData);
                                break;
                            case 'wifi': {
                                // For wifi, expect format: wifi:ssid,password,security,hidden
                                const [ssid, password, security, hidden] = qrData.split(',');
                                if (!ssid) throw new Error('WiFi SSID is required');
                                contentConfig = QrHelpers.wifi({
                                    ssid: ssid.trim(),
                                    password: password?.trim() || undefined,
                                    security: (security?.trim() as 'WPA' | 'WEP' | 'nopass') || 'WPA',
                                    hidden: hidden?.trim() === 'true' || undefined
                                });
                                break;
                            }
                            case 'sms': {
                                // For sms, expect format: sms:phoneNumber,message
                                const [phoneNumber, message] = qrData.split(',');
                                if (!phoneNumber) throw new Error('SMS phone number is required');
                                contentConfig = QrHelpers.sms({
                                    phoneNumber: phoneNumber.trim(),
                                    message: message?.trim() || undefined
                                });
                                break;
                            }
                            case 'email': {
                                // For email, expect format: email:to,subject,body
                                const [to, subject, body] = qrData.split(',');
                                if (!to) throw new Error('Email address is required');
                                contentConfig = QrHelpers.email({
                                    to: to.trim(),
                                    subject: subject?.trim() || undefined,
                                    body: body?.trim() || undefined
                                });
                                break;
                            }
                            case 'location': {
                                // For location, expect format: location:latitude,longitude,altitude
                                const [lat, lng, alt] = qrData.split(',');
                                if (!lat || !lng) throw new Error('Location latitude and longitude are required');
                                const latitude = parseFloat(lat.trim());
                                const longitude = parseFloat(lng.trim());
                                if (isNaN(latitude) || isNaN(longitude)) {
                                    throw new Error('Invalid latitude or longitude values');
                                }
                                contentConfig = QrHelpers.location({
                                    latitude,
                                    longitude,
                                    altitude: alt ? parseFloat(alt.trim()) : undefined
                                });
                                break;
                            }
                            case 'contact': {
                                // For contact, expect format: contact:firstName,lastName,phone,email,organization
                                const [firstName, lastName, phone, email, organization] = qrData.split(',');
                                contentConfig = QrHelpers.contact({
                                    firstName: firstName?.trim() || undefined,
                                    lastName: lastName?.trim() || undefined,
                                    phone: phone?.trim() || undefined,
                                    email: email?.trim() || undefined,
                                    organization: organization?.trim() || undefined
                                });
                                break;
                            }
                            default:
                                // If not a recognized type, treat as text
                                contentConfig = QrHelpers.text(qrContent);
                        }
                    } else {
                        // No type specified, treat as text
                        contentConfig = QrHelpers.text(qrContent);
                    }

                    // Generate QR API URL using the type-safe function
                    const qrApiUrl = generateQrApiUrl({
                        content: contentConfig,
                        //type: 'png', // Use PNG for inline display
                        width: 128 // Default inline size
                    });

                    // Create img element for inline QR code
                    const img = document.createElement('img');
                    img.src = getAbsoluteUrl(qrApiUrl);
                    img.className = 'qr-code-inline';
                    img.alt = `QR code: ${qrContent}`;
                    img.title = `QR code (${contentConfig.contentType}): ${qrContent}`;

                    return img.outerHTML;
                } catch (error) {
                    console.warn('Failed to generate QR code:', error);
                    return match; // Return original if QR generation fails
                }
            }
            if (componentName === "hashhighlight") {
                // Hash the text and map to a color using getHashedColor
                const text = propsString;
                const color = getHashedColor(text, { saturation: "90%", luminosity: "80%", alpha: "100%" });
                const style = `background: ${color};`;
                return `<span class="markdown-class-highlight markdown-class-hashhighlight" style="${style}">${text}</span>`;
            }
            if (componentName.startsWith("highlight")) {
                // For highlight components, we can use a specific class
                const span = document.createElement('span');
                span.className = `markdown-class-highlight markdown-class-${componentName}`;
                span.innerText = propsString;
                return span.outerHTML;
            }
            const span = document.createElement('span');
            span.className = `markdown-class-${componentName}`;
            span.innerText = propsString;
            return span.outerHTML;
        });
        return output;
    };
}