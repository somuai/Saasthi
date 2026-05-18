def for_user_geography(queryset, user):
    if not user or not user.is_authenticated:
        return queryset.none()
    if user.is_superuser or user.role in {"admin", "auditor"}:
        return queryset

    filters = {}
    for field in ("region", "district", "block", "village"):
        value = getattr(user, field, "")
        if value and any(model_field.name == field for model_field in queryset.model._meta.fields):
            filters[field] = value
    return queryset.filter(**filters) if filters else queryset
