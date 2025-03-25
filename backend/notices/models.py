class Notice(models.Model):
    NOTICE_TYPES = (
        ('general', 'General Notice'),
        ('social_bowl', 'Social Bowl'),
        ('for_sale', 'For Sale'),
    )
    
    title = models.CharField(max_length=200)
    description = models.TextField()
    notice_type = models.CharField(max_length=20, choices=NOTICE_TYPES)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='created_notices')
    club = models.ForeignKey(Club, on_delete=models.CASCADE, related_name='notices')
    date = models.DateField(blank=True, null=True)
    time = models.TimeField(blank=True, null=True)
    location = models.CharField(max_length=200, blank=True, null=True)
    price = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    image = models.ImageField(upload_to='notice_images/', blank=True, null=True)
    pdf_file = models.FileField(upload_to='notice_pdfs/', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_broadcast = models.BooleanField(default=False)
    
    class Meta:
        ordering = ['-created_at'] 